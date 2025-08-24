// ===================================================================================
//  APLICATIVO WEEDTRACK MAPAS (LÓGICA PRINCIPAL COM DEBUG)
// ===================================================================================
const MapasApp = {
    dom: {
        fazendaSelect: document.getElementById('fazendaSelect'),
        kmlSelect: document.getElementById('kmlSelect'),
        manageTalhoesBtn: document.getElementById('manageTalhoesBtn'),
        manageTalhoesModal: document.getElementById('manageTalhoesModal'),
        closeTalhoesModalBtn: document.getElementById('closeTalhoesModalBtn'),
        talhoesListContainer: document.getElementById('talhoesListContainer'),
        fazendaNameInput: document.getElementById('fazendaNameInput'),
        newTalhaoFileInput: document.getElementById('newTalhaoFileInput'),
        newTalhaoUploadBtn: document.getElementById('newTalhaoUploadBtn'),
        csvInput: document.getElementById('csvInput'),
        heatRadiusInput: document.getElementById('heatRadius'),
        generateBtn: document.getElementById('generateBtn'),
        menuCloseBtn: document.getElementById('menu-close-btn'),
        generateZoneBtn: document.getElementById('generateZoneBtn'),
        cancelZoneBtn: document.getElementById('cancelZoneBtn'),
        zoneAVazaoInput: document.getElementById('zoneAVazao'),
        zoneBVazaoInput: document.getElementById('zoneBVazao'),
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
        customZoneDoses: { a: 0, b: 100 },
        isDrawingCustomZone: false,
        kmlDatabase: [],
    },

    init() {
        this.state.map = MapManager.init('map');
        this.bindEvents();
        this.loadKmlDatabase();
        UIManager.dom.menuToggleBtn.classList.add('hidden');
    },

    bindEvents() {
        this.dom.fazendaSelect.addEventListener('change', this.handleFazendaSelect.bind(this));
        this.dom.kmlSelect.addEventListener('change', this.handleKmlSelect.bind(this));
        
        this.dom.manageTalhoesBtn.addEventListener('click', () => this.dom.manageTalhoesModal.classList.remove('hidden'));
        this.dom.closeTalhoesModalBtn.addEventListener('click', () => this.dom.manageTalhoesModal.classList.add('hidden'));
        this.dom.newTalhaoUploadBtn.addEventListener('click', this.handleKmlUpload.bind(this));
        
        this.dom.talhoesListContainer.addEventListener('click', (e) => {
            const button = e.target.closest('button');
            if (!button) return;

            const action = button.dataset.action;
            const id = button.dataset.id;
            const name = button.dataset.name;

            if (action === 'edit-fazenda') this.handleEditFazenda(id, name);
            if (action === 'edit-talhao') this.handleEditTalhao(id, name);
            if (action === 'delete') this.handleDeleteTalhao(id);
        });
        
        this.dom.generateBtn.addEventListener('click', this.handleGenerateClick.bind(this));
        UIManager.dom.menuToggleBtn.addEventListener('click', () => UIManager.toggleControlsPanel(true));
        this.dom.menuCloseBtn.addEventListener('click', () => UIManager.toggleControlsPanel(false));
        this.dom.generateBtn.addEventListener('click', () => UIManager.toggleControlsPanel(false));
        this.dom.cancelZoneBtn.addEventListener('click', () => UIManager.dom.zoneModal.classList.add('hidden'));
        this.dom.generateZoneBtn.addEventListener('click', this.handleGenerateZones.bind(this));
        this.dom.closeBulaModalBtn.addEventListener('click', () => {
            this.dom.bulaModal.classList.remove('open');
            document.body.classList.remove('modal-open');
        });
    },
    
    async loadKmlDatabase() {
        UIManager.setLoading(true, false, "A carregar dados do banco...");
        
        const { data, error } = await supabaseClient
            .from('talhoes')
            .select('id, nome_talhao, conteudo_kml, Fazenda')
            .order('Fazenda')
            .order('nome_talhao');

        if (error) {
            console.error("Erro ao carregar KMLs do Supabase:", error);
            UIManager.showToast('Não foi possível carregar os talhões.', 'error');
            this.dom.kmlSelect.innerHTML = '<option value="">Erro ao carregar</option>';
            UIManager.setLoading(false);
            return;
        }

        this.state.kmlDatabase = data;
        this.populateFazendaSelect();
        this.handleFazendaSelect(); // Popula os talhões com base na seleção da fazenda
        UIManager.setLoading(false);
    },

    populateFazendaSelect() {
        const fazendas = [...new Set(this.state.kmlDatabase.map(item => item.Fazenda || 'Sem Fazenda'))];
        const currentVal = this.dom.fazendaSelect.value;
        this.dom.fazendaSelect.innerHTML = '<option value="all">Todas as Fazendas</option>';
        
        fazendas.sort().forEach(fazenda => {
            const option = document.createElement('option');
            option.value = fazenda;
            option.textContent = fazenda;
            this.dom.fazendaSelect.appendChild(option);
        });
        this.dom.fazendaSelect.value = currentVal || 'all';
    },

    handleFazendaSelect() {
        const selectedFazenda = this.dom.fazendaSelect.value;
        this.populateKmlSelect(selectedFazenda);
        this.populateTalhoesModal(selectedFazenda);
    },

    populateKmlSelect(fazendaFilter = 'all') {
        this.dom.kmlSelect.innerHTML = '<option value="">Selecione um talhão...</option>';
        
        const filteredData = (fazendaFilter === 'all')
            ? this.state.kmlDatabase
            : this.state.kmlDatabase.filter(t => (t.Fazenda || 'Sem Fazenda') === fazendaFilter);

        if (filteredData.length > 0) {
            filteredData.forEach((talhao) => {
                const option = document.createElement('option');
                option.value = talhao.id;
                option.textContent = talhao.nome_talhao;
                this.dom.kmlSelect.appendChild(option);
            });
        }
    },

    populateTalhoesModal(fazendaFilter = 'all') {
        const container = this.dom.talhoesListContainer;
        container.innerHTML = '';
        
        const filteredData = (fazendaFilter === 'all')
            ? this.state.kmlDatabase
            : this.state.kmlDatabase.filter(t => (t.Fazenda || 'Sem Fazenda') === fazendaFilter);

        if (filteredData.length === 0) {
            container.innerHTML = '<p class="text-center text-slate-500 my-4">Nenhum talhão encontrado para esta fazenda.</p>';
            return;
        }

        filteredData.forEach(talhao => {
            const fazendaName = talhao.Fazenda || 'N/A';
            const talhaoEl = document.createElement('div');
            talhaoEl.className = 'grid grid-cols-4 gap-x-4 items-center px-3 py-2 hover:bg-slate-100 transition-colors duration-150 border-b';
            talhaoEl.innerHTML = `
                <div class="col-span-2 flex items-center gap-2 text-sm text-slate-700">
                    <span>${fazendaName}</span>
                    <button data-action="edit-fazenda" data-id="${talhao.id}" data-name="${fazendaName}" class="text-slate-400 hover:text-blue-600 transition" title="Editar Fazenda">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" class="bi bi-pencil" viewBox="0 0 16 16"><path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/></svg>
                    </button>
                </div>
                <div class="flex items-center gap-2 text-sm font-medium text-slate-800">
                    <span>${talhao.nome_talhao}</span>
                    <button data-action="edit-talhao" data-id="${talhao.id}" data-name="${talhao.nome_talhao}" class="text-slate-400 hover:text-blue-600 transition" title="Editar nome do Talhão">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" class="bi bi-pencil" viewBox="0 0 16 16"><path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/></svg>
                    </button>
                </div>
                <div class="flex items-center justify-end gap-4 pr-4">
                    <button data-action="delete" data-id="${talhao.id}" class="text-slate-500 hover:text-red-600 transition" title="Excluir Talhão">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" class="bi bi-trash3-fill" viewBox="0 0 16 16"><path d="M11 1.5v1h3.5a.5.5 0 0 1 0 1h-.538l-.853 10.66A2 2 0 0 1 11.115 16h-6.23a2 2 0 0 1-1.994-1.84L2.038 3.5H1.5a.5.5 0 0 1 0-1H5v-1A1.5 1.5 0 0 1 6.5 0h3A1.5 1.5 0 0 1 11 1.5zM4.5 5.029l.5 8.5a.5.5 0 1 0 .998-.06l-.5-8.5a.5.5 0 1 0-.998.06zm3 0l.5 8.5a.5.5 0 1 0 .998-.06l-.5-8.5a.5.5 0 1 0-.998.06zm3.5-.01l-.5 8.5a.5.5 0 1 0 .998.06l.5-8.5a.5.5 0 1 0-.998.06z"/></svg>
                    </button>
                </div>
            `;
            container.appendChild(talhaoEl);
        });
    },

    handleKmlSelect(event) {
        const selectedId = event.target.value;
        if (selectedId === "") {
            this.clearAllState();
            return;
        };

        const talhao = this.state.kmlDatabase.find(t => t.id == selectedId);
        
        if (talhao && talhao.conteudo_kml) {
            const kmlString = talhao.conteudo_kml;
            const blob = new Blob([kmlString], { type: 'application/vnd.google-earth.kml+xml' });
            const url = URL.createObjectURL(blob);
            this.processKml(url);
        } else {
            UIManager.showToast('Conteúdo KML não encontrado para este talhão.', 'error');
        }
    },

    async handleEditFazenda(id, oldName) {
        const newName = prompt("Digite o novo nome da Fazenda:", oldName);
        if (newName && newName.trim() !== '' && newName !== oldName) {
            UIManager.setLoading(true, false, `Atualizando fazenda...`);
            const { error } = await supabaseClient
                .from('talhoes')
                .update({ Fazenda: newName.trim() })
                .eq('id', id);

            if (error) {
                UIManager.showToast(`Erro: ${error.message}`, 'error');
            } else {
                UIManager.showToast('Fazenda atualizada com sucesso!', 'info');
                await this.loadKmlDatabase();
            }
            UIManager.setLoading(false);
        }
    },
    
    async handleEditTalhao(id, oldName) {
        const newName = prompt("Digite o novo nome para o talhão:", oldName);

        if (newName && newName.trim() !== '' && newName !== oldName) {
            UIManager.setLoading(true, false, `A atualizar "${oldName}"...`);
            const { error } = await supabaseClient
                .from('talhoes')
                .update({ nome_talhao: newName.trim() })
                .eq('id', id);
            
            if (error) {
                console.error("Erro ao editar talhão:", error);
                UIManager.showToast(`Erro ao atualizar: ${error.message}`, 'error');
            } else {
                UIManager.showToast('Talhão atualizado com sucesso!', 'info');
                await this.loadKmlDatabase();
            }
            UIManager.setLoading(false);
        }
    },

    async handleDeleteTalhao(id) {
        if (confirm("Tem certeza que deseja excluir este talhão? Esta ação não pode ser desfeita.")) {
            UIManager.setLoading(true, false, "A excluir talhão...");
            const selectedId = this.dom.kmlSelect.value;
            const { error } = await supabaseClient.from('talhoes').delete().eq('id', id);

            if (error) {
                UIManager.showToast(`Erro ao excluir: ${error.message}`, 'error');
            } else {
                UIManager.showToast('Talhão excluído com sucesso!', 'info');
                if(selectedId && selectedId == id) {
                    this.clearAllState();
                }
                await this.loadKmlDatabase();
            }
            UIManager.setLoading(false);
        }
    },
    
    async handleKmlUpload() {
        const kmlFiles = this.dom.newTalhaoFileInput.files;
        const fazendaName = this.dom.fazendaNameInput.value.trim();

        if (kmlFiles.length === 0) {
            UIManager.showToast('Por favor, selecione um ou mais ficheiros KML.', 'error');
            return;
        }
        if (!fazendaName) {
            UIManager.showToast('Por favor, digite o nome da fazenda.', 'error');
            return;
        }

        UIManager.setLoading(true, false, `A salvar ${kmlFiles.length} talhões...`);

        const newTalhoes = [];
        const fileReadPromises = Array.from(kmlFiles).map(file => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (event) => {
                    newTalhoes.push({
                        nome_talhao: file.name.replace(/\.kml$/i, ''),
                        conteudo_kml: event.target.result,
                        Fazenda: fazendaName
                    });
                    resolve();
                };
                reader.onerror = reject;
                reader.readAsText(file);
            });
        });

        try {
            await Promise.all(fileReadPromises);
            const { error } = await supabaseClient.from('talhoes').insert(newTalhoes);

            if (error) {
                UIManager.showToast(`Erro ao salvar: ${error.message}`, 'error');
            } else {
                UIManager.showToast(`${kmlFiles.length} talhão(ões) salvos com sucesso!`, 'info');
                this.dom.newTalhaoFileInput.value = '';
                this.dom.fazendaNameInput.value = '';
                await this.loadKmlDatabase();
            }
        } catch (readError) {
            UIManager.showToast('Ocorreu um erro ao ler os ficheiros KML.', 'error');
        } finally {
            UIManager.setLoading(false);
        }
    },

    clearAllState() {
        MapManager.clearAllMapLayers();
        this.state.generatedHeatmaps = [];
        this.state.activeLayers.clear();
        this.state.kmlLayer = null;
        this.state.kmlGeoJSON = null;
        this.state.markersLayer = null;
        this.state.pointsGeoJSON = null;
    },

    processKml(url) {
        UIManager.setLoading(true, false, "A carregar KML...");
        this.clearAllState();
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
                    MapManager.customLayerControl.addOverlay(this.state.kmlLayer, 'Talhão (KML)', kmlActions);
                    this.state.map.fitBounds(this.state.kmlLayer.getBounds());
                } else {
                    UIManager.showToast('Nenhum polígono encontrado no KML.', 'error');
                }
                URL.revokeObjectURL(url);
                UIManager.setLoading(false);
            })
            .on('error', (err) => {
                UIManager.showToast('Erro ao carregar o ficheiro KML.', 'error');
                console.error(err);
                UIManager.setLoading(false);
            });
    },

    handleGenerateClick() {
        const csvFile = this.dom.csvInput.files[0];
        const radiusM = parseFloat(this.dom.heatRadiusInput.value) || 50;
        if (!this.state.kmlGeoJSON) { UIManager.showToast('Por favor, selecione um talhão primeiro.', 'error'); return; }
        if (!csvFile) { UIManager.showToast('Por favor, selecione um ficheiro CSV.', 'error'); return; }
        const customIcon = L.icon({
            iconUrl: 'Logo.svg',
            shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
            iconSize:     [35, 35], 
            iconAnchor:   [17, 35], 
            popupAnchor:  [0, -35],
            shadowSize:   [41, 41],
            shadowAnchor: [12, 41]
        });
        UIManager.setLoading(true, false, "A processar CSV...");
        Papa.parse(csvFile, {
            header: true, dynamicTyping: true, skipEmptyLines: true,
            complete: results => {
                const data = results.data;
                if (!data.length) { UIManager.showToast('O ficheiro CSV está vazio ou em formato inválido.', 'error'); UIManager.setLoading(false); return; }
                this.state.activeLayers.forEach((layer, name) => {
                    if (name !== 'Talhão (KML)') {
                        if (this.state.map.hasLayer(layer)) this.state.map.removeLayer(layer);
                        this.state.activeLayers.delete(name);
                    }
                });
                MapManager.customLayerControl.clearLayers();
                const kmlActions = [{
                    title: 'Baixar como GeoJSON',
                    icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-download" viewBox="0 0 16 16"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/><path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/></svg>`,
                    onClick: () => this.downloadData('talhao.geojson', this.state.kmlGeoJSON, 'geojson')
                }];
                MapManager.customLayerControl.addOverlay(this.state.kmlLayer, 'Talhão (KML)', kmlActions);
                const keys = Object.keys(data[0]);
                const latKey = keys.find(k => /lat/i.test(k));
                const lonKey = keys.find(k => /lon/i.test(k));
                if (!latKey || !lonKey) { UIManager.showToast('Não foi possível encontrar colunas de latitude/longitude no CSV.', 'error'); UIManager.setLoading(false); return; }
                const speciesKeys = keys.filter(k => k !== latKey && k !== lonKey && !/filename/i.test(k));
                this.state.markersLayer = L.layerGroup();
                const pointFeatures = [];
                const heatData = {};
                speciesKeys.forEach(sp => (heatData[sp] = []));

                data.forEach(row => {
                    const lat = row[latKey], lon = row[lonKey];
                    if (lat == null || lon == null) return;

                    const pestsFound = speciesKeys.filter(sp => row[sp] > 0);
                    let label;

                    if (pestsFound.length > 0) {
                        label = `<b>Alvos:</b><br>${pestsFound.map(sp => `${sp}: ${row[sp]}`).join('<br>')}`;
                        pestsFound.forEach(sp => heatData[sp].push([lat, lon, row[sp]]));
                    } else {
                        label = "Nenhum Alvo encontrado";
                    }
                    
                    L.marker([lat, lon], { icon: customIcon }).bindTooltip(label).addTo(this.state.markersLayer);
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
                MapManager.customLayerControl.addOverlay(this.state.markersLayer, 'Pontos (CSV)', pointsActions);
                UIManager.setLoading(true, true);
                this.processSpeciesAsync(speciesKeys, heatData, radiusM, 0);
            },
            error: err => {
                UIManager.showToast('Erro ao processar o CSV: ' + err.message, 'error');
                UIManager.setLoading(false);
            }
        });
    },
    
    processSpeciesAsync(speciesKeys, heatData, radiusM, index) {
        if (index >= speciesKeys.length) {
            UIManager.setLoading(false);
            this.setupActionButtons();
            return;
        }
        const species = speciesKeys[index];
        UIManager.updateProgress(index + 1, speciesKeys.length, `A processar ${species}`);
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
                MapManager.customLayerControl.addOverlay(heatLayer, layerName, heatmapActions);
            }
            this.processSpeciesAsync(speciesKeys, heatData, radiusM, index + 1);
        }, 50);
    },

    setupActionButtons() {
        MapManager.downloadControl.getContainer().innerHTML = '';
        MapManager.zoneControl.getContainer().innerHTML = '';
        MapManager.reportControl.getContainer().innerHTML = ''; // Limpa o container do relatório
        MapManager.recomendacaoControl.getContainer().innerHTML = '';

        const zoneButton = document.createElement('button');
        zoneButton.className = 'bg-purple-600 text-white font-semibold py-2 px-4 rounded-md shadow-md hover:bg-purple-700 mt-2';
        zoneButton.textContent = 'Criar Zona de Manejo';
        zoneButton.onclick = () => UIManager.openZoneModal(this.state.generatedHeatmaps);
        MapManager.zoneControl.getContainer().appendChild(zoneButton);
        
        // Botão de Criar Relatório
        const reportButton = document.createElement('button');
        reportButton.className = 'bg-gray-700 text-white font-semibold py-2 px-4 rounded-md shadow-md hover:bg-gray-800 mt-2';
        reportButton.textContent = 'Criar Relatório';
        reportButton.onclick = () => ReportGenerator.open(this.state);
        MapManager.reportControl.getContainer().appendChild(reportButton);

        const recomendacaoButton = document.createElement('button');
        recomendacaoButton.className = 'bg-green-600 text-white font-semibold py-2 px-4 rounded-md shadow-md hover:bg-green-700 mt-2';
        recomendacaoButton.textContent = 'Criar Recomendação';
        recomendacaoButton.onclick = () => {
            BulaApp.open(this.state);
            document.body.classList.add('modal-open');
        };
        MapManager.recomendacaoControl.getContainer().appendChild(recomendacaoButton);
    },

    handleGenerateZones() {
        const selectedOption = UIManager.dom.speciesSelect.value;
        if (!selectedOption) { UIManager.showToast("Por favor, selecione uma opção.", 'error'); return; }
        if (selectedOption === 'personalizado') {
            this.startCustomZoneDrawing();
        } else {
            this.generateZonesFromHeatmap(selectedOption);
        }
    },
    
    generateZonesFromHeatmap(speciesName) {
        const vazaoA = parseFloat(this.dom.zoneAVazaoInput.value) || 0;
        const vazaoB = parseFloat(this.dom.zoneBVazaoInput.value) || 0;
        UIManager.dom.zoneModal.classList.add('hidden');
        UIManager.setLoading(true, true, "A gerar Zonas...");
        setTimeout(() => {
            try {
                const heatmapLayer = this.state.activeLayers.get(`Heatmap – ${speciesName}`);
                if (!heatmapLayer || !heatmapLayer.blurredGrid) { UIManager.showToast("Dados do mapa de calor não encontrados.", 'error'); UIManager.setLoading(false); return; }
                const resolution = 250, threshold = heatmapLayer.maxIntensity * 0.2;
                const contours = findContours(heatmapLayer.blurredGrid, resolution, resolution, threshold);
                if (contours.length === 0) { UIManager.showToast("Nenhuma Zona B encontrada para o limiar definido.", 'info'); UIManager.setLoading(false); return; }
                const bounds = heatmapLayer._bounds;
                const lonRange = bounds.getEast() - bounds.getWest(), latRange = bounds.getNorth() - bounds.getSouth();
                const zoneBFeatures = contours.map(contour => {
                    const coordinates = contour.map(p => [bounds.getWest() + (p.x / resolution) * lonRange, bounds.getNorth() - (p.y / resolution) * latRange]);
                    coordinates.push(coordinates[0]);
                    return turf.polygon([coordinates]);
                });
                const clippedZoneBFeatures = zoneBFeatures.map(f => turf.intersect(this.state.kmlGeoJSON, f)).filter(Boolean);
                if (clippedZoneBFeatures.length === 0) { UIManager.showToast("Nenhuma Zona B dentro do talhão.", 'info'); UIManager.setLoading(false); return; }
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
                    UIManager.showToast("Infestação alta. A zona de manejo cobrirá todo o talhão.", 'info');
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
                MapManager.customLayerControl.addOverlay(zoneLayer, layerName, zoneActions);
            } catch (err) {
                console.error("Erro ao gerar zonas:", err);
                UIManager.showToast("Ocorreu um erro ao gerar as zonas de manejo.", 'error');
            } finally {
                UIManager.setLoading(false);
            }
        }, 50);
    },

    startCustomZoneDrawing() {
        UIManager.dom.zoneModal.classList.add('hidden');
        UIManager.toggleControlsPanel(false);
        UIManager.showToast('Desenhe o polígono da sua zona de manejo no mapa.', 'info');
        this.state.customZoneDoses = {
            a: parseFloat(this.dom.zoneAVazaoInput.value) || 0,
            b: parseFloat(this.dom.zoneBVazaoInput.value) || 100,
        };
        this.state.map.addControl(MapManager.drawControl);
        this.state.map.off('draw:created');
        this.state.map.on('draw:created', this.handleCustomZoneCreated, this);
        this.state.map.on('draw:drawstop', this.cleanupCustomDrawListeners, this);
        new L.Draw.Polygon(this.state.map, MapManager.drawControl.options.draw.polygon).enable();
    },

    handleCustomZoneCreated(event) {
        const layer = event.layer;
        const drawnGeoJSON = layer.toGeoJSON();
        if (!this.state.kmlGeoJSON) {
            UIManager.showToast('Erro: Limite do talhão (KML) não encontrado.', 'error');
            return;
        }
        const clippedGeoJSON = turf.intersect(this.state.kmlGeoJSON, drawnGeoJSON);
        if (!clippedGeoJSON) {
            UIManager.showToast('O polígono desenhado está fora dos limites do talhão.', 'error');
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
        MapManager.customLayerControl.addOverlay(zoneLayer, layerName, zoneActions);
        UIManager.showToast('Zona personalizada criada com sucesso!', 'info');
    },

    cleanupCustomDrawListeners() {
        this.state.map.removeControl(MapManager.drawControl);
        this.state.map.off('draw:created', this.handleCustomZoneCreated, this);
        this.state.map.off('draw:drawstop', this.cleanupCustomDrawListeners, this);
    },

    async downloadShapefile(geojson) {
        UIManager.setLoading(true, false, 'A converter para Shapefile...');
        try {
            const response = await fetch(SHAPEFILE_CONVERTER_URL, {
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
            UIManager.showToast('Download do Shapefile iniciado.', 'info');
        } catch (error) {
            console.error("Erro ao converter para Shapefile:", error);
            UIManager.showToast(`Erro na conversão: ${error.message}`, 'error');
        } finally {
            UIManager.setLoading(false);
        }
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
};