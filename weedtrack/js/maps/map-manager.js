// ===================================================================================
//  GERENCIADOR DO MAPA (LEAFLET)
// ===================================================================================
const MapManager = {
    map: null,
    drawnItems: null,
    drawControl: null,
    customLayerControl: null,
    downloadControl: null,
    zoneControl: null,
    recomendacaoControl: null,

    init(mapId) {
        this.map = L.map(mapId).setView([-14.235, -51.925], 4);
        // LINHA CORRIGIDA: A URL agora usa {x} e {y} corretamente.
        L.tileLayer('https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {
            maxZoom: 20,
            subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
            attribution: '&copy; Google Maps'
        }).addTo(this.map);

        this.initCustomControls();
        this.initDrawControls();

        setTimeout(() => this.map.invalidateSize(), 50);
        return this.map;
    },

    initCustomControls() {
        L.Control.ButtonPlaceholder = L.Control.extend({
            onAdd: () => L.DomUtil.create('div', 'leaflet-control-download-placeholder'),
        });
        this.downloadControl = new L.Control.ButtonPlaceholder({ position: 'topright' }).addTo(this.map);
        this.zoneControl = new L.Control.ButtonPlaceholder({ position: 'topright' }).addTo(this.map);
        this.recomendacaoControl = new L.Control.ButtonPlaceholder({ position: 'topright' }).addTo(this.map);
        
        this.initLayerControl();
        this.initRecenterControl();
    },

    initLayerControl() {
        const self = this;
        L.Control.CustomLayers = L.Control.extend({
            onAdd: function(map) {
                const container = L.DomUtil.create('div', 'custom-layers-control leaflet-control');
                L.DomEvent.disableScrollPropagation(container);
                L.DomEvent.disableClickPropagation(container);
                this._container = container;
                const header = L.DomUtil.create('div', 'custom-layers-control-header', container);
                L.DomUtil.create('h3', '', header).textContent = 'Camadas';
                const toggleBtn = L.DomUtil.create('button', 'layer-toggle-btn', header);
                toggleBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M1 8a.5.5 0 0 1 .5-.5h13a.5.5 0 0 1 0 1h-13A.5.5 0 0 1 1 8z"/></svg>`;
                toggleBtn.title = "Recolher/Expandir";
                toggleBtn.onclick = () => {
                    const isCollapsed = this._container.classList.toggle('collapsed');
                    toggleBtn.innerHTML = isCollapsed ?
                        `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16"><path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/></svg>` :
                        `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M1 8a.5.5 0 0 1 .5-.5h13a.5.5 0 0 1 0 1h-13A.5.5 0 0 1 1 8z"/></svg>`;
                };
                this._listContainer = L.DomUtil.create('div', 'custom-layers-list', container);
                return this._container;
            },
            addOverlay: function(layer, name, actions = []) {
                const row = L.DomUtil.create('div', 'custom-layers-control-row', this._listContainer);
                const id = `layer-checkbox-${name.replace(/\s+/g, '-')}`;
                const label = L.DomUtil.create('label', '', row);
                label.htmlFor = id;
                const checkbox = L.DomUtil.create('input', '', label);
                checkbox.type = 'checkbox';
                checkbox.id = id;
                checkbox.checked = self.map.hasLayer(layer);
                checkbox.onchange = () => {
                    if (checkbox.checked) self.map.addLayer(layer);
                    else self.map.removeLayer(layer);
                };
                L.DomUtil.create('span', '', label).textContent = name;
                if (actions.length > 0) {
                    const actionsContainer = L.DomUtil.create('div', 'layer-actions-container', row);
                    actions.forEach(action => {
                        const actionBtn = L.DomUtil.create('button', 'download-layer-btn', actionsContainer);
                        actionBtn.title = action.title;
                        actionBtn.innerHTML = action.icon;
                        actionBtn.onclick = action.onClick;
                    });
                }
            },
            clearLayers: function() { this._listContainer.innerHTML = ''; }
        });
        this.customLayerControl = new L.Control.CustomLayers({ position: 'topright' }).addTo(this.map);
    },

    initRecenterControl() {
        L.Control.Recenter = L.Control.extend({
            onAdd: () => {
                const btn = L.DomUtil.create('button', 'recenter-control');
                btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="bi bi-arrows-fullscreen" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M5.828 10.172a.5.5 0 0 0-.707 0l-4.096 4.096V11.5a.5.5 0 0 0-1 0v3.975a.5.5 0 0 0 .5.5H4.5a.5.5 0 0 0 0-1H1.732l4.096-4.096a.5.5 0 0 0 0-.707zm4.344 0a.5.5 0 0 1 .707 0l-4.096 4.096V11.5a.5.5 0 1 1 1 0v3.975a.5.5 0 0 1-.5.5H11.5a.5.5 0 0 1 0-1h2.768l-4.096-4.096a.5.5 0 0 1 0-.707zm0-4.344a.5.5 0 0 0 .707 0l4.096-4.096V4.5a.5.5 0 1 0 1 0V.525a.5.5 0 0 0-.5-.5H11.5a.5.5 0 0 0 0 1h2.768l-4.096 4.096a.5.5 0 0 0 0 .707zm-4.344 0a.5.5 0 0 1-.707 0L1.025 1.732V4.5a.5.5 0 0 1-1 0V.525a.5.5 0 0 1 .5-.5H4.5a.5.5 0 0 1 0 1H1.732l4.096 4.096a.5.5 0 0 1 0 .707z"/></svg>`;
                btn.title = 'Recentralizar no KML';
                btn.onclick = () => {
                    const kmlLayer = MapasApp.state.kmlLayer;
                    if (kmlLayer && kmlLayer.getBounds().isValid()) {
                        this.map.fitBounds(kmlLayer.getBounds());
                    } else {
                        UIManager.showToast('Nenhum KML carregado para recentralizar.', 'error');
                    }
                };
                return btn;
            },
        });
        new L.Control.Recenter({ position: 'topleft' }).addTo(this.map);
    },

    initDrawControls() {
        this.drawnItems = new L.FeatureGroup();
        this.map.addLayer(this.drawnItems);
        this.drawControl = new L.Control.Draw({
            edit: { featureGroup: this.drawnItems, remove: true },
            draw: {
                polygon: { shapeOptions: { color: '#0ea5e9', weight: 2, fillOpacity: 0.3 } },
                polyline: false, rectangle: false, circle: false,
                marker: false, circlemarker: false
            }
        });
    },

    clearAllMapLayers() {
        this.downloadControl.getContainer().innerHTML = '';
        this.zoneControl.getContainer().innerHTML = '';
        this.recomendacaoControl.getContainer().innerHTML = '';
        
        MapasApp.state.activeLayers.forEach(layer => {
            if (this.map.hasLayer(layer)) {
                this.map.removeLayer(layer);
            }
        });
        this.customLayerControl.clearLayers();
        this.drawnItems.clearLayers();
    }
};