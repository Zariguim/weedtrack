// ===================================================================================
//  CAMADA DE HEATMAP E ALGORITMOS (CÓDIGO AUXILIAR)
// ===================================================================================

const RasterHeatLayer = L.ImageOverlay.extend({
    initialize: function (latlngs, options) {
        this.latlngs = latlngs;
        L.setOptions(this, options);
        this._bounds = L.geoJSON(options.kml).getBounds();
        this._generateHeatmapRaster();
        L.ImageOverlay.prototype.initialize.call(this, this.imageUrl, this._bounds, { opacity: 1, interactive: false });
    },
    _generateHeatmapRaster: function() {
        const resolution = 250; 
        const bounds = this._bounds;
        const radiusMeters = this.options.radius || 50;
        
        const canvas = document.createElement('canvas');
        canvas.width = resolution;
        canvas.height = resolution;
        const ctx = canvas.getContext('2d');

        const geoWidth = bounds.getSouthWest().distanceTo(bounds.getSouthEast());
        const pixelRadius = (radiusMeters / geoWidth) * resolution;
        
        const grid = new Array(resolution * resolution).fill(0);
        this.latlngs.forEach(p => {
            const [lat, lon, weight] = p;
            const x = Math.floor(((lon - bounds.getWest()) / (bounds.getEast() - bounds.getWest())) * resolution);
            const y = Math.floor(((bounds.getNorth() - lat) / (bounds.getNorth() - bounds.getSouth())) * resolution);
            if (x >= 0 && x < resolution && y >= 0 && y < resolution) {
                grid[y * resolution + x] += weight;
            }
        });

        this.blurredGrid = this._gaussianBlur(grid, resolution, resolution, pixelRadius);

        let maxIntensity = 0;
        for (let i = 0; i < this.blurredGrid.length; i++) {
            if (this.blurredGrid[i] > maxIntensity) maxIntensity = this.blurredGrid[i];
        }
        if (maxIntensity === 0) maxIntensity = 1;
        this.maxIntensity = maxIntensity;

        const coloredData = ctx.createImageData(resolution, resolution);
        const pixels = coloredData.data;
        const lerpColor = (a, b, amount) => a.map((c, i) => c + amount * (b[i] - c));
        const gradientStops = { 0.0: [0, 128, 0], 0.5: [255, 255, 0], 1.0: [255, 0, 0] };
        
        for (let i = 0; i < this.blurredGrid.length; i++) {
            const intensity = this.blurredGrid[i] / this.maxIntensity;
            let color;
            if (intensity < 0.02) { color = gradientStops[0.0]; }
            else if (intensity <= 0.5) { color = lerpColor(gradientStops[0.0], gradientStops[0.5], intensity / 0.5); }
            else { color = lerpColor(gradientStops[0.5], gradientStops[1.0], (intensity - 0.5) / 0.5); }
            
            const pixelIndex = i * 4;
            pixels[pixelIndex] = color[0];
            pixels[pixelIndex+1] = color[1];
            pixels[pixelIndex+2] = color[2];
            pixels[pixelIndex+3] = 255; 
        }
        ctx.putImageData(coloredData, 0, 0);

        const polygon = this.options.kml.geometry.coordinates[0];
        ctx.globalCompositeOperation = 'destination-in';
        ctx.beginPath();
        polygon.forEach((coord, index) => {
            const x = ((coord[0] - bounds.getWest()) / (bounds.getEast() - bounds.getWest())) * resolution;
            const y = ((bounds.getNorth() - coord[1]) / (bounds.getNorth() - bounds.getSouth())) * resolution;
            if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.fill();
        this.imageUrl = canvas.toDataURL(); // <-- LINHA REVERTIDA PARA PNG
    },
    _gaussianBlur: function(data, width, height, sigma) {
        const kernel = this._createKernel(sigma);
        const radius = kernel.length >> 1;
        const temp = new Float32Array(data.length);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let sum = 0;
                for (let i = -radius; i <= radius; i++) {
                    const xi = x + i;
                    if (xi >= 0 && xi < width) sum += data[y * width + xi] * kernel[i + radius];
                }
                temp[y * width + x] = sum;
            }
        }
        const result = new Float32Array(data.length);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let sum = 0;
                for (let j = -radius; j <= radius; j++) {
                    const yj = y + j;
                    if (yj >= 0 && yj < height) sum += temp[yj * width + x] * kernel[j + radius];
                }
                result[y * width + x] = sum;
            }
        }
        return result;
    },
    _createKernel: function(sigma) {
        const radius = Math.ceil(sigma * 3);
        const kernel = new Float32Array(radius * 2 + 1);
        const sigma2 = 2 * sigma * sigma;
        let sum = 0;
        for (let i = -radius; i <= radius; i++) {
            const value = Math.exp(-(i * i) / sigma2);
            kernel[i + radius] = value;
            sum += value;
        }
        for (let i = 0; i < kernel.length; i++) kernel[i] /= sum;
        return kernel;
    }
});

function findContours(data, width, height, threshold) {
    const segments = []; const lerp = (a, b) => (threshold - a) / (b - a);
    for (let y = 0; y < height - 1; y++) {
        for (let x = 0; x < width - 1; x++) {
            const i = y * width + x;
            const v = [data[i], data[i + 1], data[i + width + 1], data[i + width]];
            let state = 0;
            if (v[0] > threshold) state |= 8; if (v[1] > threshold) state |= 4;
            if (v[2] > threshold) state |= 2; if (v[3] > threshold) state |= 1;
            const p = [ { x: x + lerp(v[0], v[1]), y: y }, { x: x + 1, y: y + lerp(v[1], v[2]) }, { x: x + lerp(v[3], v[2]), y: y + 1 }, { x: x, y: y + lerp(v[0], v[3]) } ];
            switch (state) {
                case 1: segments.push([p[2], p[3]]); break; case 2: segments.push([p[1], p[2]]); break;
                case 3: segments.push([p[1], p[3]]); break; case 4: segments.push([p[0], p[1]]); break;
                case 5: segments.push([p[0], p[3]]); segments.push([p[1], p[2]]); break;
                case 6: segments.push([p[0], p[2]]); break; case 7: segments.push([p[0], p[3]]); break;
                case 8: segments.push([p[0], p[3]]); break; case 9: segments.push([p[0], p[2]]); break;
                case 10: segments.push([p[0], p[1]]); segments.push([p[2], p[3]]); break;
                case 11: segments.push([p[0], p[1]]); break; case 12: segments.push([p[1], p[3]]); break;
                case 13: segments.push([p[1], p[2]]); break; case 14: segments.push([p[2], p[3]]); break;
            }
        }
    }
    return linkSegments(segments);
}

function linkSegments(segments) {
    const paths = [];
    while (segments.length > 0) {
        const path = [segments[0].shift(), segments[0].pop()];
        segments.splice(0, 1);
        let changed = true;
        while (changed) {
            changed = false;
            for (let i = segments.length - 1; i >= 0; i--) {
                const s = segments[i];
                if (s[0].x === path[path.length - 1].x && s[0].y === path[path.length - 1].y) { path.push(s[1]); segments.splice(i, 1); changed = true; } 
                else if (s[1].x === path[path.length - 1].x && s[1].y === path[path.length - 1].y) { path.push(s[0]); segments.splice(i, 1); changed = true; } 
                else if (s[0].x === path[0].x && s[0].y === path[0].y) { path.unshift(s[1]); segments.splice(i, 1); changed = true; } 
                else if (s[1].x === path[0].x && s[1].y === path[0].y) { path.unshift(s[0]); segments.splice(i, 1); changed = true; }
            }
        }
        paths.push(path);
    }
    return paths;
}