// ===================================================================================
//  APLICATIVO WEEDTRACK MAPAS (LÓGICA PRINCIPAL)
// ===================================================================================
const MapasApp = {
    dom: {
        kmlInput: document.getElementById('kmlInput'),
        csvInput: document.getElementById('csvInput'),
        heatRadiusInput: document.getElementById('heatRadius'),
        generateBtn: document.getElementById('generateBtn'),
        loader: document.getElementById('loader'),
        spinner: document.getElementById('spinner'),
        progressContainer: document.getElementById('progress-container'),
        progressBar: document.getElementById('progress-bar'),
        progressText: document.getElementById('progress-text'),
        toast: document.getElementById('toast'),
        toastMessage: document.getElementById('toast-message'),
        controlsPanel: document.getElementById('controls-panel'),
        menuToggleBtn: document.getElementById('menu-toggle-btn'),
        menuCloseBtn: document.getElementById('menu-close-btn'),
        zoneModal: document.getElementById('zoneModal'),
        speciesSelect: document.getElementById('speciesSelect'),
        generateZoneBtn: document.getElementById('generateZoneBtn'),
        cancelZoneBtn: document.getElementById('cancelZoneBtn'),
        downloadPdfContainer: document.getElementById('downloadPdfContainer'),
        createZoneContainer: document.getElementById('createZoneContainer'),
        createRecomendacaoContainer: document.getElementById('createRecomendacaoContainer'),
        zoneAVazaoInput: document.getElementById('zoneAVazao'),
        zoneBVazaoInput: document.getElementById('zoneBVazao'),
        drawKmlBtn: document.getElementById('drawKmlBtn'),
        bulaModal: document.getElementById('bulaModal'),
        closeBulaModalBtn: document.getElementById('closeBulaModalBtn'),
    },
    state: {
        map: null,
        kmlLayer: null,
        kmlGeoJSON: null,
        markersLayer: null,
        pointsGeoJSON: null,
        generatedHeatmaps: [],
        activeLayers: new Map(),
        customLayerControl: null,
        downloadControl: null,
        zoneControl: null,
        recomendacaoControl: null,
        drawnItems: null,
        drawControl: null,
        customZoneDoses: { a: 0, b: 100 },
        isDrawingCustomZone: false,
    },

    init() {
        this.initMap();
        this.bindEvents();
        this.initCustomControls();
        this.initDrawControls();
        this.dom.menuToggleBtn.classList.add('hidden');
        setTimeout(() => this.state.map.invalidateSize(), 50);
    },

    toggleControlsPanel(show) {
        if (show) {
            this.dom.controlsPanel.classList.remove('-translate-x-full');
            this.dom.menuToggleBtn.classList.add('hidden');
        } else {
            this.dom.controlsPanel.classList.add('-translate-x-full');
            this.dom.menuToggleBtn.classList.remove('hidden');
        }
    },

    initMap() {
        this.state.map = L.map('map').setView([-14.235, -51.925], 4);
        L.tileLayer('https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {
            maxZoom: 20,
            subdomains:['mt0','mt1','mt2','mt3'],
            attribution: '&copy; Google Maps'
        }).addTo(this.state.map);
    },
    
    initCustomControls() {
        L.Control.ButtonPlaceholder = L.Control.extend({
            onAdd: (map) => L.DomUtil.create('div', 'leaflet-control-download-placeholder'),
        });
        this.state.downloadControl = new L.Control.ButtonPlaceholder({ position: 'topright' }).addTo(this.state.map);
        this.state.zoneControl = new L.Control.ButtonPlaceholder({ position: 'topright' }).addTo(this.state.map);
        this.state.recomendacaoControl = new L.Control.ButtonPlaceholder({ position: 'topright' }).addTo(this.state.map);
        
        this.initLayerControl();
        this.initRecenterControl();
    },

    initLayerControl() {
        const self = this;
        L.Control.CustomLayers = L.Control.extend({
            onAdd: function(map) {
                const container = L.DomUtil.create('div', 'custom-layers-control leaflet-control');
                // --- CORREÇÃO DO BUG 2: Impede que o scroll do mouse no painel afete o zoom do mapa ---
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
                checkbox.checked = self.state.map.hasLayer(layer);
                checkbox.onchange = () => {
                    if (checkbox.checked) self.state.map.addLayer(layer);
                    else self.state.map.removeLayer(layer);
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
        this.state.customLayerControl = new L.Control.CustomLayers({ position: 'topright' }).addTo(this.state.map);
    },

    initRecenterControl() {
        const self = this;
        L.Control.Recenter = L.Control.extend({
            onAdd: function() {
                const btn = L.DomUtil.create('button', 'recenter-control');
                btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="bi bi-arrows-fullscreen" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M5.828 10.172a.5.5 0 0 0-.707 0l-4.096 4.096V11.5a.5.5 0 0 0-1 0v3.975a.5.5 0 0 0 .5.5H4.5a.5.5 0 0 0 0-1H1.732l4.096-4.096a.5.5 0 0 0 0-.707zm4.344 0a.5.5 0 0 1 .707 0l-4.096 4.096V11.5a.5.5 0 1 1 1 0v3.975a.5.5 0 0 1-.5.5H11.5a.5.5 0 0 1 0-1h2.768l-4.096-4.096a.5.5 0 0 1 0-.707zm0-4.344a.5.5 0 0 0 .707 0l4.096-4.096V4.5a.5.5 0 1 0 1 0V.525a.5.5 0 0 0-.5-.5H11.5a.5.5 0 0 0 0 1h2.768l-4.096 4.096a.5.5 0 0 0 0 .707zm-4.344 0a.5.5 0 0 1-.707 0L1.025 1.732V4.5a.5.5 0 0 1-1 0V.525a.5.5 0 0 1 .5-.5H4.5a.5.5 0 0 1 0 1H1.732l4.096 4.096a.5.5 0 0 1 0 .707z"/></svg>`;
                btn.title = 'Recentralizar no KML';
                btn.onclick = () => {
                    if (self.state.kmlLayer && self.state.kmlLayer.getBounds().isValid()) self.state.map.fitBounds(self.state.kmlLayer.getBounds());
                    else self.showToast('Nenhum KML carregado para recentralizar.', 'error');
                };
                return btn;
            },
        });
        new L.Control.Recenter({ position: 'topleft' }).addTo(this.state.map);
    },

    // --- CORREÇÃO DO BUG 1: O controle de desenho só é criado, mas não adicionado ao mapa ---
    initDrawControls() {
        this.state.drawnItems = new L.FeatureGroup();
        this.state.map.addLayer(this.state.drawnItems);
        this.state.drawControl = new L.Control.Draw({
            edit: { featureGroup: this.state.drawnItems, remove: true },
            draw: {
                polygon: { shapeOptions: { color: '#0ea5e9', weight: 2, fillOpacity: 0.3 } },
                polyline: false, rectangle: false, circle: false,
                marker: false, circlemarker: false
            }
        });
        // A linha "this.state.map.addControl(this.state.drawControl);" foi REMOVIDA daqui.
        this.state.map.on('draw:created', this.handleNewKmlDrawn, this);
    },

    bindEvents() {
        this.dom.kmlInput.addEventListener('change', e => {
            const file = e.target.files[0];
            if (!file) return;
            const url = URL.createObjectURL(file);
            this.processKml(url);
        });
        this.dom.generateBtn.addEventListener('click', this.handleGenerateClick.bind(this));
        this.dom.menuToggleBtn.addEventListener('click', () => this.toggleControlsPanel(true));
        this.dom.menuCloseBtn.addEventListener('click', () => this.toggleControlsPanel(false));
        this.dom.generateBtn.addEventListener('click', () => this.toggleControlsPanel(false)); 
        this.dom.drawKmlBtn.addEventListener('click', () => {
            // --- CORREÇÃO DO BUG 1: Adiciona o controle de desenho ao clicar no botão ---
            this.state.map.addControl(this.state.drawControl);
            new L.Draw.Polygon(this.state.map, this.state.drawControl.options.draw.polygon).enable();
        });
        this.dom.cancelZoneBtn.addEventListener('click', () => this.dom.zoneModal.classList.add('hidden'));
        this.dom.generateZoneBtn.addEventListener('click', this.handleGenerateZones.bind(this));
        this.dom.closeBulaModalBtn.addEventListener('click', () => {
            this.dom.bulaModal.classList.remove('open');
            document.body.classList.remove('modal-open');
        });
    },
    
    showToast(message, type = 'error') {
        this.dom.toastMessage.textContent = message;
        this.dom.toast.className = `fixed bottom-5 right-5 text-white py-3 px-5 rounded-lg shadow-xl z-[101] transition-opacity duration-300 ${type === 'info' ? 'bg-blue-600' : 'bg-red-600'}`;
        this.dom.toast.classList.remove('hidden');
        setTimeout(() => { this.dom.toast.classList.add('hidden'); }, 5000);
    },
    setLoading(isLoading, isProcessing = false, text = "") {
        if (isLoading) {
            this.dom.loader.classList.remove('hidden');
            this.dom.spinner.style.display = isProcessing ? 'none' : 'block';
            this.dom.progressContainer.style.display = isProcessing ? 'block' : 'none';
            this.dom.progressText.textContent = text;
        } else {
            this.dom.loader.classList.add('hidden');
        }
    },
    updateProgress(current, total, text = "A gerar imagem") {
        const percent = Math.round((current / total) * 100);
        this.dom.progressBar.style.width = `${percent}%`;
        this.dom.progressBar.textContent = `${percent}%`;
        this.dom.progressText.textContent = `${text}...`;
    },
    downloadData(filename, data, type) {
        const a = document.createElement('a');
        let url;
        if (type === 'geojson') {
            url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
        } else if (type === 'png') {
            url = data;
        } else return;
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        if (type === 'geojson') URL.revokeObjectURL(url);
    },
    clearAllLayers() {
        this.state.downloadControl.getContainer().innerHTML = '';
        this.state.zoneControl.getContainer().innerHTML = '';
        this.state.recomendacaoControl.getContainer().innerHTML = '';
        this.state.generatedHeatmaps = [];
        this.state.activeLayers.forEach(layer => {
            if (this.state.map.hasLayer(layer)) {
                this.state.map.removeLayer(layer);
            }
        });
        this.state.activeLayers.clear();
        this.state.customLayerControl.clearLayers();
        this.state.drawnItems.clearLayers();
        this.state.kmlLayer = null;
        this.state.kmlGeoJSON = null;
        this.state.markersLayer = null;
        this.state.pointsGeoJSON = null;
    },

    processKml(url) {
        this.setLoading(true, false, "A carregar KML...");
        this.clearAllLayers();
        const kmlActions = [{
            title: 'Baixar como GeoJSON',
            icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-download" viewBox="0 0 16 16"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/><path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/></svg>`,
            onClick: () => this.downloadData('talhao.geojson', this.state.kmlGeoJSON, 'geojson')
        }];
        this.state.kmlLayer = omnivore.kml(url)
            .on('ready', () => {
                this.state.kmlLayer.eachLayer(layer => {
                    if (layer.toGeoJSON && ['Polygon', 'MultiPolygon'].includes(layer.toGeoJSON().geometry.type)) {
                        this.state.kmlGeoJSON = layer.toGeoJSON();
                    }
                });
                if (this.state.kmlGeoJSON) {
                    this.state.map.addLayer(this.state.kmlLayer);
                    this.state.activeLayers.set('Talhão (KML)', this.state.kmlLayer);
                    this.state.customLayerControl.addOverlay(this.state.kmlLayer, 'Talhão (KML)', kmlActions);
                    this.state.map.fitBounds(this.state.kmlLayer.getBounds());
                } else {
                    this.showToast('Nenhum polígono encontrado no KML.', 'error');
                }
                URL.revokeObjectURL(url);
                this.setLoading(false);
            })
            .on('error', (err) => {
                this.showToast('Erro ao carregar o ficheiro KML.', 'error');
                console.error(err);
                this.setLoading(false);
            });
    },
    
    handleGenerateClick() {
        const csvFile = this.dom.csvInput.files[0];
        const radiusM = parseFloat(this.dom.heatRadiusInput.value) || 50;
        if (!this.state.kmlGeoJSON) { this.showToast('Por favor, carregue um ficheiro KML primeiro.', 'error'); return; }
        if (!csvFile) { this.showToast('Por favor, selecione um ficheiro CSV.', 'error'); return; }
        const customIcon = L.icon({
            iconUrl: 'Logo.svg',
            shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
            iconSize:     [35, 35], 
            iconAnchor:   [17, 35], 
            popupAnchor:  [0, -35],
            shadowSize:   [41, 41],
            shadowAnchor: [12, 41]
        });
        this.setLoading(true, false, "A processar CSV...");
        Papa.parse(csvFile, {
            header: true, dynamicTyping: true, skipEmptyLines: true,
            complete: results => {
                const data = results.data;
                if (!data.length) { this.showToast('O ficheiro CSV está vazio ou em formato inválido.', 'error'); this.setLoading(false); return; }
                this.state.activeLayers.forEach((layer, name) => {
                    if (name !== 'Talhão (KML)') {
                        if (this.state.map.hasLayer(layer)) this.state.map.removeLayer(layer);
                        this.state.activeLayers.delete(name);
                    }
                });
                this.state.customLayerControl.clearLayers();
                const kmlActions = [{
                    title: 'Baixar como GeoJSON',
                    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-download" viewBox="0 0 16 16"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/><path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/></svg>`,
                    onClick: () => this.downloadData('talhao.geojson', this.state.kmlGeoJSON, 'geojson')
                }];
                this.state.customLayerControl.addOverlay(this.state.kmlLayer, 'Talhão (KML)', kmlActions);
                const keys = Object.keys(data[0]);
                const latKey = keys.find(k => /lat/i.test(k));
                const lonKey = keys.find(k => /lon/i.test(k));
                if (!latKey || !lonKey) { this.showToast('Não foi possível encontrar colunas de latitude/longitude no CSV.', 'error'); this.setLoading(false); return; }
                const speciesKeys = keys.filter(k => k !== latKey && k !== lonKey && !/filename/i.test(k));
                this.state.markersLayer = L.layerGroup();
                const pointFeatures = [];
                const heatData = {};
                speciesKeys.forEach(sp => (heatData[sp] = []));
                data.forEach(row => {
                    const lat = row[latKey], lon = row[lonKey];
                    if (lat == null || lon == null) return;
                    const pestsFound = speciesKeys.filter(sp => row[sp] > 0);
                    if (pestsFound.length > 0) {
                        const label = `<b>Alvos:</b><br>${pestsFound.map(sp => `${sp}: ${row[sp]}`).join('<br>')}`;
                        L.marker([lat, lon], { icon: customIcon }).bindTooltip(label).addTo(this.state.markersLayer);
                    }
                    pestsFound.forEach(sp => heatData[sp].push([lat, lon, row[sp]]));
                    pointFeatures.push(turf.point([lon, lat], row));
                });
                this.state.pointsGeoJSON = turf.featureCollection(pointFeatures);
                this.state.map.addLayer(this.state.markersLayer);
                this.state.activeLayers.set('Pontos (CSV)', this.state.markersLayer);
                const pointsActions = [{
                    title: 'Baixar Pontos como GeoJSON',
                    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-download" viewBox="0 0 16 16"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/><path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/></svg>`,
                    onClick: () => this.downloadData('pontos.geojson', this.state.pointsGeoJSON, 'geojson')
                }];
                this.state.customLayerControl.addOverlay(this.state.markersLayer, 'Pontos (CSV)', pointsActions);
                this.setLoading(true, true);
                this.processSpeciesAsync(speciesKeys, heatData, radiusM, 0);
            },
            error: err => {
                this.showToast('Erro ao processar o CSV: ' + err.message, 'error');
                this.setLoading(false);
            }
        });
    },
    
    processSpeciesAsync(speciesKeys, heatData, radiusM, index) {
        if (index >= speciesKeys.length) {
            this.setLoading(false);
            this.setupActionButtons();
            return;
        }
        const species = speciesKeys[index];
        this.updateProgress(index + 1, speciesKeys.length, `A processar ${species}`);
        setTimeout(() => {
            if (heatData[species].length > 0) {
                const heatLayer = new RasterHeatLayer(heatData[species], { kml: this.state.kmlGeoJSON, radius: radiusM });
                const layerName = `Heatmap – ${species}`;
                this.state.activeLayers.set(layerName, heatLayer);
                this.state.generatedHeatmaps.push({ name: species, imageUrl: heatLayer.imageUrl });
                const heatmapActions = [{
                    title: `Baixar Heatmap ${species} como PNG`,
                    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-download" viewBox="0 0 16 16"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/><path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/></svg>`,
                    onClick: () => this.downloadData(`heatmap_${species}.png`, heatLayer.imageUrl, 'png')
                }];
                this.state.customLayerControl.addOverlay(heatLayer, layerName, heatmapActions);
            }
            this.processSpeciesAsync(speciesKeys, heatData, radiusM, index + 1);
        }, 50);
    },

    setupActionButtons() {
        this.state.downloadControl.getContainer().innerHTML = '';
        this.state.zoneControl.getContainer().innerHTML = '';
        this.state.recomendacaoControl.getContainer().innerHTML = '';
        const zoneButton = document.createElement('button');
        zoneButton.className = 'bg-purple-600 text-white font-semibold py-2 px-4 rounded-md shadow-md hover:bg-purple-700';
        zoneButton.textContent = 'Criar Zona de Manejo';
        zoneButton.onclick = this.openZoneModal.bind(this);
        this.state.zoneControl.getContainer().appendChild(zoneButton);
        const recomendacaoButton = document.createElement('button');
        recomendacaoButton.className = 'bg-green-600 text-white font-semibold py-2 px-4 rounded-md shadow-md hover:bg-green-700 mt-2';
        recomendacaoButton.textContent = 'Criar Recomendação';
        recomendacaoButton.onclick = () => {
            BulaApp.open(this.state);
            document.body.classList.add('modal-open');
        };
        this.state.recomendacaoControl.getContainer().appendChild(recomendacaoButton);
    },

    openZoneModal() {
        this.dom.speciesSelect.innerHTML = '';
        const customOption = document.createElement('option');
        customOption.value = 'personalizado';
        customOption.textContent = 'Zona Personalizada (Desenhar)';
        this.dom.speciesSelect.appendChild(customOption);
        this.state.generatedHeatmaps.forEach(h => {
            const option = document.createElement('option');
            option.value = h.name; option.textContent = h.name;
            this.dom.speciesSelect.appendChild(option);
        });
        this.dom.zoneModal.classList.remove('hidden');
    },
    
    handleGenerateZones() {
        const selectedOption = this.dom.speciesSelect.value;
        if (!selectedOption) { this.showToast("Por favor, selecione uma opção.", 'error'); return; }
        if (selectedOption === 'personalizado') {
            this.startCustomZoneDrawing();
        } else {
            this.generateZonesFromHeatmap(selectedOption);
        }
    },
    
    generateZonesFromHeatmap(speciesName) {
        const vazaoA = parseFloat(this.dom.zoneAVazaoInput.value) || 0;
        const vazaoB = parseFloat(this.dom.zoneBVazaoInput.value) || 0;
        this.dom.zoneModal.classList.add('hidden');
        this.setLoading(true, true, "A gerar Zonas...");
        setTimeout(() => {
            try {
                const heatmapLayer = this.state.activeLayers.get(`Heatmap – ${speciesName}`);
                if (!heatmapLayer || !heatmapLayer.blurredGrid) { this.showToast("Dados do mapa de calor não encontrados.", 'error'); this.setLoading(false); return; }
                const resolution = 250, threshold = heatmapLayer.maxIntensity * 0.2;
                const contours = findContours(heatmapLayer.blurredGrid, resolution, resolution, threshold);
                if (contours.length === 0) { this.showToast("Nenhuma Zona B encontrada para o limiar definido.", 'info'); this.setLoading(false); return; }
                const bounds = heatmapLayer._bounds;
                const lonRange = bounds.getEast() - bounds.getWest(), latRange = bounds.getNorth() - bounds.getSouth();
                const zoneBFeatures = contours.map(contour => {
                    const coordinates = contour.map(p => [bounds.getWest() + (p.x / resolution) * lonRange, bounds.getNorth() - (p.y / resolution) * latRange]);
                    coordinates.push(coordinates[0]);
                    return turf.polygon([coordinates]);
                });
                const clippedZoneBFeatures = zoneBFeatures.map(f => turf.intersect(this.state.kmlGeoJSON, f)).filter(Boolean);
                if (clippedZoneBFeatures.length === 0) { this.showToast("Nenhuma Zona B dentro do talhão.", 'info'); this.setLoading(false); return; }
                clippedZoneBFeatures.forEach(feature => { feature.properties = { zone: 'B', dose: vazaoB }; });
                let allZonesBJoined;
                if (clippedZoneBFeatures.length > 1) {
                    allZonesBJoined = turf.union(...clippedZoneBFeatures.map(f => turf.clone(f)));
                } else {
                    allZonesBJoined = turf.clone(clippedZoneBFeatures[0]);
                }
                let finalFeatures = [];
                let zoneAGeoJSON = null;
                if (allZonesBJoined) {
                    try { zoneAGeoJSON = turf.difference(this.state.kmlGeoJSON, allZonesBJoined); } catch (e) { console.error("Erro em turf.difference", e); zoneAGeoJSON = null; }
                }
                if (zoneAGeoJSON) {
                    zoneAGeoJSON.properties = { zone: 'A', dose: vazaoA };
                    finalFeatures = [zoneAGeoJSON, ...clippedZoneBFeatures];
                } else {
                    this.showToast("Infestação alta. A zona de manejo cobrirá todo o talhão.", 'info');
                    finalFeatures = clippedZoneBFeatures;
                }
                const finalZones = turf.featureCollection(finalFeatures.filter(Boolean));
                const zoneLayer = L.geoJSON(finalZones, {
                    style: f => f.properties.zone === 'A' ? { color: 'green', weight: 1, fillOpacity: 0.3 } : { color: 'red', weight: 2, fillOpacity: 0.5 }
                });
                const layerName = `Zonas de Manejo - ${speciesName}`;
                this.state.map.addLayer(zoneLayer);
                this.state.activeLayers.set(layerName, zoneLayer);
                const zoneActions = [
                    {
                        title: 'Baixar como GeoJSON',
                        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-filetype-json" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M14 4.5V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h5.5L14 4.5ZM7.5 11.5a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2a.5.5 0 0 1 .5.5Zm-1-2a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1h-1Zm1-2a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2a.5.5 0 0 1 .5.5Zm-1-2a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1h-1Z"/><path d="M11.854 7.146a.5.5 0 0 0-.708 0L10.5 7.793V6.5a.5.5 0 0 0-1 0v1.293L8.854 7.146a.5.5 0 1 0-.708.708L9.293 9h-2.586a.5.5 0 0 0 0 1h2.586L8.146 11.146a.5.5 0 1 0 .708.708L10.5 10.207V11.5a.5.5 0 0 0 1 0v-1.293l1.646 1.647a.5.5 0 0 0 .708-.708L11.707 9h2.586a.5.5 0 0 0 0-1h-2.586l1.647-1.146a.5.5 0 0 0 0-.708Z"/></svg>`,
                        onClick: () => this.downloadData(`zonas_${speciesName}.geojson`, finalZones, 'geojson')
                    },
                    {
                        title: 'Baixar como Shapefile (.zip)',
                        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-file-earmark-zip" viewBox="0 0 16 16"><path d="M5 7.5a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v.938l.4 1.599a1 1 0 0 1-.416 1.074l-.93.62a1 1 0 0 1-1.109 0l-.93-.62a1 1 0 0 1-.415-1.074l.4-1.599V7.5Zm1 0v.938a2 2 0 0 0 .83 1.646l.93.62a2 2 0 0 0 2.218 0l.93-.62a2 2 0 0 0 .83-1.646V7.5a2 2 0 0 0-2-2h-1a2 2 0 0 0-2 2Z"/><path d="M14 4.5V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h5.5L14 4.5Zm-3 0A1.5 1.5 0 0 1 9.5 3V1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4.5h-2Z"/></svg>`,
                        onClick: () => this.downloadShapefile(finalZones)
                    }
                ];
                this.state.customLayerControl.addOverlay(zoneLayer, layerName, zoneActions);
            } catch (err) {
                console.error("Erro ao gerar zonas:", err);
                this.showToast("Ocorreu um erro ao gerar as zonas de manejo.", 'error');
            } finally {
                this.setLoading(false);
            }
        }, 50);
    },

    handleNewKmlDrawn(event) {
        // --- CORREÇÃO DO BUG 1: Remove o controle de desenho após a conclusão ---
        this.state.map.removeControl(this.state.drawControl);
        const layer = event.layer;
        this.state.drawnItems.addLayer(layer);
        const geoJSON = layer.toGeoJSON();
        const kmlString = this.geoJSONToKML(geoJSON);
        const blob = new Blob([kmlString], { type: 'application/vnd.google-earth.kml+xml' });
        const url = URL.createObjectURL(blob);
        this.processKml(url);
        this.showToast('Talhão desenhado com sucesso!', 'info');
    },
    
    startCustomZoneDrawing() {
        this.dom.zoneModal.classList.add('hidden');
        this.toggleControlsPanel(false);
        this.showToast('Desenhe o polígono da sua zona de manejo no mapa.', 'info');
        this.state.customZoneDoses = {
            a: parseFloat(this.dom.zoneAVazaoInput.value) || 0,
            b: parseFloat(this.dom.zoneBVazaoInput.value) || 100,
        };
        // --- CORREÇÃO DO BUG 1: Adiciona o controle de desenho ao mapa ---
        this.state.map.addControl(this.state.drawControl);
        this.state.map.off('draw:created', this.handleNewKmlDrawn, this);
        this.state.map.on('draw:created', this.handleCustomZoneCreated, this);
        this.state.map.on('draw:drawstop', this.cleanupCustomDrawListeners, this);
        new L.Draw.Polygon(this.state.map, this.state.drawControl.options.draw.polygon).enable();
    },

    handleCustomZoneCreated(event) {
        const layer = event.layer;
        const drawnGeoJSON = layer.toGeoJSON();
        if (!this.state.kmlGeoJSON) {
            this.showToast('Erro: Limite do talhão (KML) não encontrado.', 'error');
            return;
        }
        const clippedGeoJSON = turf.intersect(this.state.kmlGeoJSON, drawnGeoJSON);
        if (!clippedGeoJSON) {
            this.showToast('O polígono desenhado está fora dos limites do talhão.', 'error');
            return;
        }
        clippedGeoJSON.properties = { zone: 'B', dose: this.state.customZoneDoses.b };
        const zoneAGeoJSON = turf.difference(this.state.kmlGeoJSON, clippedGeoJSON);
        if (zoneAGeoJSON) {
            zoneAGeoJSON.properties = { zone: 'A', dose: this.state.customZoneDoses.a };
        }
        const finalZones = turf.featureCollection([zoneAGeoJSON, clippedGeoJSON].filter(Boolean));
        const layerName = 'Zonas de Manejo - Personalizado';
        const zoneLayer = L.geoJSON(finalZones, {
            style: f => f.properties.zone === 'A' ? { color: 'green', weight: 1, fillOpacity: 0.3 } : { color: 'red', weight: 2, fillOpacity: 0.5 }
        });
        this.state.map.addLayer(zoneLayer);
        this.state.activeLayers.set(layerName, zoneLayer);
        const zoneActions = [
            {
                title: 'Baixar como GeoJSON',
                icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-filetype-json" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M14 4.5V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h5.5L14 4.5ZM7.5 11.5a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2a.5.5 0 0 1 .5.5Zm-1-2a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1h-1Zm1-2a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2a.5.5 0 0 1 .5.5Zm-1-2a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1h-1Z"/><path d="M11.854 7.146a.5.5 0 0 0-.708 0L10.5 7.793V6.5a.5.5 0 0 0-1 0v1.293L8.854 7.146a.5.5 0 1 0-.708.708L9.293 9h-2.586a.5.5 0 0 0 0 1h2.586L8.146 11.146a.5.5 0 1 0 .708.708L10.5 10.207V11.5a.5.5 0 0 0 1 0v-1.293l1.646 1.647a.5.5 0 0 0 .708-.708L11.707 9h2.586a.5.5 0 0 0 0-1h-2.586l1.647-1.146a.5.5 0 0 0 0-.708Z"/></svg>`,
                onClick: () => this.downloadData(`zonas_personalizado.geojson`, finalZones, 'geojson')
            },
            {
                title: 'Baixar como Shapefile (.zip)',
                icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-file-earmark-zip" viewBox="0 0 16 16"><path d="M5 7.5a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v.938l.4 1.599a1 1 0 0 1-.416 1.074l-.93.62a1 1 0 0 1-1.109 0l-.93-.62a1 1 0 0 1-.415-1.074l.4-1.599V7.5Zm1 0v.938a2 2 0 0 0 .83 1.646l.93.62a2 2 0 0 0 2.218 0l.93-.62a2 2 0 0 0 .83-1.646V7.5a2 2 0 0 0-2-2h-1a2 2 0 0 0-2 2Z"/><path d="M14 4.5V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h5.5L14 4.5Zm-3 0A1.5 1.5 0 0 1 9.5 3V1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4.5h-2Z"/></svg>`,
                onClick: () => this.downloadShapefile(finalZones)
            }
        ];
        this.state.customLayerControl.addOverlay(zoneLayer, layerName, zoneActions);
        this.showToast('Zona personalizada criada com sucesso!', 'info');
    },

    cleanupCustomDrawListeners() {
        // --- CORREÇÃO DO BUG 1: Remove o controle de desenho após a conclusão ou cancelamento ---
        this.state.map.removeControl(this.state.drawControl);
        this.state.map.off('draw:created', this.handleCustomZoneCreated, this);
        this.state.map.off('draw:drawstop', this.cleanupCustomDrawListeners, this);
        this.state.map.on('draw:created', this.handleNewKmlDrawn, this);
    },

    async downloadShapefile(geojson) {
        const serverUrl = 'https://weedtrack-conversor-backend.onrender.com/converter';
        this.setLoading(true, false, 'A converter para Shapefile...');
        try {
            const response = await fetch(serverUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(geojson)
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.erro || `Erro do servidor: ${response.statusText}`);
            }
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = 'mapa_de_aplicacao.zip'; 
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            this.showToast('Download do Shapefile iniciado.', 'info');
        } catch (error) {
            console.error("Erro ao converter para Shapefile:", error);
            this.showToast(`Erro na conversão: ${error.message}`, 'error');
        } finally {
            this.setLoading(false);
        }
    },

    geoJSONToKML(geoJSON) {
        let kml = '<?xml version="1.0" encoding="UTF-8"?>';
        kml += '<kml xmlns="http://www.opengis.net/kml/2.2">';
        kml += '<Placemark>';
        kml += '<name>Talhão Desenhado</name>';
        kml += '<Polygon>';
        kml += '<outerBoundaryIs><LinearRing><coordinates>';
        const coords = geoJSON.geometry.coordinates[0];
        coords.forEach(p => { kml += `${p[0]},${p[1]},0 `; });
        kml += '</coordinates></LinearRing></outerBoundaryIs>';
        kml += '</Polygon>';
        kml += '</Placemark>';
        kml += '</kml>';
        return kml;
    }
};