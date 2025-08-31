// ===================================================================================
//  APLICATIVO WEEDTRACK BULA (LÓGICA DO MODAL) - CORRIGIDO
// ===================================================================================
const BulaApp = {
    dom: {
        bulaModal: document.getElementById('bulaModal'),
        tankCapacity: document.getElementById('tankCapacity'),
        flowRate: document.getElementById('flowRate'),
        areaInput: document.getElementById('areaInput'),
        totalAreaObs: document.getElementById('totalAreaObs'),
        zoneAreaObs: document.getElementById('zoneAreaObs'),
        addTotalPesticideBtn: document.getElementById('addTotalPesticideBtn'),
        addZonePesticideBtn: document.getElementById('addZonePesticideBtn'),
        generatePdfBtn: document.getElementById('generateBulaPdfBtn'),
        totalAreaCard: document.getElementById('totalAreaCard'),
        zoneAreaCard: document.getElementById('zoneAreaCard'),
        totalAreaInfo: document.getElementById('totalAreaInfo'),
        zoneAreaInfo: document.getElementById('zoneAreaInfo'),
        totalAreaPesticides: document.getElementById('totalAreaPesticides'),
        zoneAreaPesticides: document.getElementById('zoneAreaPesticides'),
        pdfPreviewContainer: document.getElementById('pdfPreviewContainer'),
        pdfPlaceholder: document.getElementById('pdfPlaceholder'),
        unitModal: document.getElementById('unitModal'),
        unitKgBtn: document.getElementById('unitKgBtn'),
        unitLBtn: document.getElementById('unitLBtn'),
        zoneSelect: document.getElementById('zoneSelect'),
        confirmZoneSelectionBtn: document.getElementById('confirmZoneSelectionBtn'),
    },

    state: {
        parentState: null, // Referência para o estado do MapasApp
        zoneGeoJSON: null,
        pesticides: { total: [], zone: [] },
        observations: { total: '', zone: '' },
        unitModalCallback: null,
        logoSvgString: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2ZM12 11.5C10.62 11.5 9.5 10.38 9.5 9C9.5 7.62 10.62 6.5 12 6.5C13.38 6.5 14.5 7.62 14.5 9C14.5 10.38 13.38 11.5 12 11.5Z" fill="#47555A"/><path d="M12 6.5C10.62 6.5 9.5 7.62 9.5 9C9.5 10.38 10.62 11.5 12 11.5C13.38 11.5 14.5 10.38 14.5 9C14.5 7.62 13.38 6.5 12 6.5Z" fill="white"/><path d="M11.21 8.46938C11.3486 8.22034 11.6848 8.13836 11.9349 8.27459C12.1849 8.41083 12.2669 8.74699 12.1307 8.99694L10.9807 11.247C10.8448 11.497 10.5086 11.5789 10.2586 11.4426C9.9977 11.3064 9.91576 10.9706 11.0517 10.7202L11.21 8.46938Z" fill="#47555A"/></svg>',
    },
    
    init() {
        this.bindEvents();
        this.initSortable();
    },
    
    open(mapasState) {
        if (!mapasState.kmlGeoJSON) {
            UIManager.showToast("Carregue um KML primeiro para criar uma recomendação.", "error");
            return;
        }
        this.state.parentState = mapasState;
        
        this.resetForm();
        const areaHa = turf.area(this.state.parentState.kmlGeoJSON) / 10000;
        this.dom.areaInput.value = areaHa.toFixed(2);
        
        this.populateHeatmapPreview();
        this.populateZoneSelector();
        this.updateCalculations();
        this.dom.bulaModal.classList.add('open');
    },

    resetForm() {
        this.dom.totalAreaPesticides.innerHTML = '';
        this.dom.zoneAreaPesticides.innerHTML = '';
        this.dom.totalAreaObs.value = '';
        this.dom.zoneAreaObs.value = '';
        this.dom.zoneAreaCard.classList.add('hidden');
        this.state.pesticides = { total: [], zone: [] };
        this.state.observations = { total: '', zone: '' };
        this.state.zoneGeoJSON = null;
    },
    
    populateHeatmapPreview() {
        this.dom.pdfPreviewContainer.innerHTML = '';
        if (this.state.parentState.generatedHeatmaps.length > 0) {
            this.dom.pdfPlaceholder.style.display = 'none';
            this.state.parentState.generatedHeatmaps.forEach(heatmap => {
                const mapContainer = document.createElement('div');
                mapContainer.className = 'bg-white p-2 rounded-lg shadow';

                const title = document.createElement('h3');
                title.className = 'text-sm font-semibold text-center text-slate-700 mb-2';
                title.textContent = heatmap.name;

                const img = document.createElement('img');
                img.src = heatmap.imageUrl;
                img.alt = `Mapa de calor para ${heatmap.name}`;
                img.className = 'w-full h-auto rounded';

                mapContainer.appendChild(title);
                mapContainer.appendChild(img);
                this.dom.pdfPreviewContainer.appendChild(mapContainer);
            });
        } else {
            this.dom.pdfPlaceholder.style.display = 'block';
            this.dom.pdfPlaceholder.textContent = 'Nenhum mapa de calor foi gerado.';
        }
    },

    populateZoneSelector() {
        this.dom.zoneSelect.innerHTML = '<option value="">Não, aplicar na área total</option>';
        this.state.parentState.activeLayers.forEach((layer, name) => {
            if (name.startsWith('Zonas de Manejo')) {
                const option = document.createElement('option');
                option.value = name;
                option.textContent = name;
                this.dom.zoneSelect.appendChild(option);
            }
        });
    },

    bindEvents() {
        const debouncedUpdate = this.debounce(this.updateCalculations.bind(this), 300);
        ['change', 'keyup'].forEach(evt => {
            this.dom.tankCapacity.addEventListener(evt, debouncedUpdate);
            this.dom.flowRate.addEventListener(evt, debouncedUpdate);
            this.dom.areaInput.addEventListener(evt, debouncedUpdate);
        });
        
        this.dom.confirmZoneSelectionBtn.addEventListener('click', this.handleZoneSelection.bind(this));
        this.dom.addTotalPesticideBtn.addEventListener('click', () => this.addPesticideRow('total'));
        this.dom.addZonePesticideBtn.addEventListener('click', () => this.addPesticideRow('zone'));
        this.dom.generatePdfBtn.addEventListener('click', this.generatePdf.bind(this));
        
        this.dom.unitKgBtn.addEventListener('click', () => this.handleUnitSelection('Kg/ha'));
        this.dom.unitLBtn.addEventListener('click', () => this.handleUnitSelection('L/ha'));

        this.dom.totalAreaObs.addEventListener('keyup', (e) => this.state.observations.total = e.target.value);
        this.dom.zoneAreaObs.addEventListener('keyup', (e) => this.state.observations.zone = e.target.value);
    },
    
    debounce(func, delay) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    },
    
    handleZoneSelection() {
        const selectedLayerName = this.dom.zoneSelect.value;
        if (selectedLayerName && this.state.parentState.activeLayers.has(selectedLayerName)) {
            const layer = this.state.parentState.activeLayers.get(selectedLayerName);
            this.state.zoneGeoJSON = layer.toGeoJSON();
            this.dom.zoneAreaCard.classList.remove('hidden');
        } else {
            this.state.zoneGeoJSON = null;
            this.dom.zoneAreaCard.classList.add('hidden');
        }
        this.updateCalculations();
    },

    updateCalculations() {
        const areaHaTotal = parseFloat(this.dom.areaInput.value) || 0;
        this.dom.generatePdfBtn.disabled = areaHaTotal <= 0;

        this.updateCardInfo('total', areaHaTotal, this.dom.totalAreaInfo);

        if (this.state.zoneGeoJSON) {
            const zoneBFeatures = this.state.zoneGeoJSON.features.filter(f => f.properties && f.properties.zone === 'B');
            let areaHaZoneB = 0;
            if (zoneBFeatures.length > 0) {
                areaHaZoneB = turf.area(turf.featureCollection(zoneBFeatures)) / 10000;
            }
            this.updateCardInfo('zone', areaHaZoneB, this.dom.zoneAreaInfo, " (Zona B)");
        }
    },
    
    updateCardInfo(type, area, element, areaLabelSuffix = "") {
         if (area <= 0) {
            element.innerHTML = `Nenhuma área${areaLabelSuffix} para calcular.`;
            return;
         }
        const tankCapacity = parseFloat(this.dom.tankCapacity.value) || 0;
        const flowRate = parseFloat(this.dom.flowRate.value) || 0;
        
        let baseText = `Área${areaLabelSuffix}: <strong>${area.toFixed(2)} ha</strong>.`;
        if (tankCapacity > 0 && flowRate > 0) {
            const haPerTank = tankCapacity / flowRate;
            const tanksNeeded = area / haPerTank;
            baseText += ` Serão necessários <strong>${tanksNeeded.toFixed(2)} tanques</strong>.`;
        }
        element.innerHTML = baseText;
    },

    addPesticideRow(type) {
        const container = type === 'total' ? this.dom.totalAreaPesticides : this.dom.zoneAreaPesticides;
        const pesticide = { id: Date.now(), name: '', dose: '', unit: 'L/ha' };
        this.state.pesticides[type].push(pesticide);

        const row = document.createElement('div');
        row.className = 'grid grid-cols-12 gap-2 items-center';
        row.dataset.id = pesticide.id;
        row.innerHTML = `
            <span class="drag-handle col-span-1 cursor-move text-slate-400 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-grip-vertical" viewBox="0 0 16 16"><path d="M7 2a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-3 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-3 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/></svg>
            </span>
            <input type="text" placeholder="Nome do Defensivo" class="col-span-5 p-2 border border-gray-300 rounded-md text-sm" data-field="name">
            <input type="number" placeholder="Dose" class="col-span-2 p-2 border border-gray-300 rounded-md text-sm" data-field="dose">
            <button class="unit-btn col-span-3 bg-gray-200 p-2 rounded-md text-sm">${pesticide.unit}</button>
            <button class="remove-btn col-span-1 text-red-500 hover:text-red-700 p-1 font-bold text-xl flex justify-center items-center">&times;</button>
        `;
        container.appendChild(row);

        row.querySelectorAll('input').forEach(input => {
            input.addEventListener('change', (e) => this.updatePesticide(e, pesticide.id, type));
        });
        row.querySelector('.unit-btn').addEventListener('click', (e) => this.openUnitModal(e, pesticide.id, type));
        row.querySelector('.remove-btn').addEventListener('click', () => {
            this.removePesticide(pesticide.id, type);
            row.remove();
        });
    },

    updatePesticide(e, id, type) {
        const pIndex = this.state.pesticides[type].findIndex(p => p.id == id);
        if (pIndex > -1) {
            this.state.pesticides[type][pIndex][e.target.dataset.field] = e.target.value;
        }
    },

    removePesticide(id, type) {
        this.state.pesticides[type] = this.state.pesticides[type].filter(p => p.id != id);
    },

    openUnitModal(e, id, type) {
        this.dom.unitModal.classList.remove('hidden');
        this.state.unitModalCallback = (unit) => {
            const pIndex = this.state.pesticides[type].findIndex(p => p.id == id);
            if (pIndex > -1) {
                this.state.pesticides[type][pIndex].unit = unit;
                e.target.textContent = unit;
            }
            this.dom.unitModal.classList.add('hidden');
            this.state.unitModalCallback = null;
        };
    },

    handleUnitSelection(unit) {
        if (this.state.unitModalCallback) {
            this.state.unitModalCallback(unit);
        }
    },
    
    initSortable() {
        const onEnd = (evt, type) => {
            const item = this.state.pesticides[type].splice(evt.oldIndex, 1)[0];
            this.state.pesticides[type].splice(evt.newIndex, 0, item);
        };
        new Sortable(this.dom.totalAreaPesticides, { handle: '.drag-handle', animation: 150, ghostClass: 'sortable-ghost', onEnd: (evt) => onEnd(evt, 'total') });
        new Sortable(this.dom.zoneAreaPesticides, { handle: '.drag-handle', animation: 150, ghostClass: 'sortable-ghost', onEnd: (evt) => onEnd(evt, 'zone') });
    },
    
    async convertSvgToPngBase64(svgString, width, height) {
        return new Promise((resolve, reject) => {
            const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(svgBlob);
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                URL.revokeObjectURL(url);
                resolve(canvas.toDataURL('image/png'));
            };
            img.onerror = (err) => {
                URL.revokeObjectURL(url);
                reject(err);
            };
            img.src = url;
        });
    },

    async generatePdf() {
        UIManager.setLoading(true, false, 'A gerar Bula...');
        const { jsPDF } = window.jspdf;
        const hasTotalRec = this.state.pesticides.total.length > 0 && parseFloat(this.dom.areaInput.value) > 0;
        const hasZoneRec = this.state.zoneGeoJSON && this.state.pesticides.zone.length > 0;

        if (!hasTotalRec && !hasZoneRec) {
            UIManager.showToast("Nenhum defensivo foi adicionado.", "error");
            UIManager.setLoading(false);
            return;
        }

        UIManager.setLoading(true, false, 'A capturar imagens do mapa...');
        let kmlImage = null;
        let zoneImage = null;

        const mapContainer = document.createElement('div');
        mapContainer.style.width = '1000px';
        mapContainer.style.height = '750px';
        mapContainer.style.position = 'absolute';
        mapContainer.style.left = '-9999px';
        document.body.appendChild(mapContainer);
        
        const mapForCapture = L.map(mapContainer, { zoomControl: false, attributionControl: false, preferCanvas: true });
        L.tileLayer('https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {
            maxZoom: 20,
            subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
        }).addTo(mapForCapture);

        await new Promise(r => setTimeout(r, 500)); 

        if (this.state.parentState.kmlGeoJSON) {
            const kmlLayer = L.geoJSON(this.state.parentState.kmlGeoJSON, { style: { color: '#3388ff', weight: 2 } }).addTo(mapForCapture);
            mapForCapture.fitBounds(kmlLayer.getBounds(), { padding: [10, 10] });
            await new Promise(r => setTimeout(r, 1000));
            kmlImage = await html2canvas(mapContainer).then(c => c.toDataURL('image/jpeg', 0.9));
            mapForCapture.removeLayer(kmlLayer);
        }

        if (this.state.zoneGeoJSON) {
            const zoneLayer = L.geoJSON(this.state.zoneGeoJSON, {
                style: (feature) => {
                    if (feature.properties.zone === 'B') {
                        return { color: '#ef4444', weight: 2, fillOpacity: 0.5 };
                    }
                    return { color: '#22c55e', weight: 1, fillOpacity: 0.3 };
                }
            }).addTo(mapForCapture);
            mapForCapture.fitBounds(zoneLayer.getBounds(), { padding: [10, 10] });
            await new Promise(r => setTimeout(r, 1000));
            zoneImage = await html2canvas(mapContainer).then(c => c.toDataURL('image/jpeg', 0.9));
            mapForCapture.removeLayer(zoneLayer);
        }
        document.body.removeChild(mapContainer);

        UIManager.setLoading(true, false, 'A montar o relatório PDF...');
        const doc = new jsPDF('p', 'mm', 'a4');
        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();
        let yPos = 20;
        let pageCounter = 1;
        const logoPng = await this.convertSvgToPngBase64(this.state.logoSvgString, 24, 24);

        const addFooter = (pageNumber) => {
            const margin = 15;
            doc.setFontSize(8);
            doc.setTextColor(150);
            
            doc.addImage(logoPng, 'PNG', margin, pageH - 12, 5, 5);
            doc.text('Weedtrack', margin + 7, pageH - 8.5);
            
            doc.setFontSize(7);
            doc.setTextColor(180);
            doc.text('Precisão no diagnóstico, resultado no manejo.', margin + 25, pageH - 8.5);

            doc.text(`${pageNumber}`, pageW - margin, pageH - 8.5, { align: 'right' });
        };
        
        addFooter(pageCounter);

        doc.setFontSize(22).setFont(undefined, 'bold').setTextColor(0);
        doc.text('Recomendação de Aplicação - Weedtrack', pageW / 2, yPos, { align: 'center' });
        yPos += 15;
        
        if (hasTotalRec) yPos = this.drawRecommendationBlock(doc, yPos, 'Recomendação em Área Total', this.dom.totalAreaInfo.innerText, this.state.pesticides.total, this.state.observations.total, kmlImage);
        if (hasTotalRec && hasZoneRec) yPos += 10;
        if (hasZoneRec) yPos = this.drawRecommendationBlock(doc, yPos, 'Recomendação em Zona de Manejo', this.dom.zoneAreaInfo.innerText, this.state.pesticides.zone, this.state.observations.zone, zoneImage);

        const signatureY = pageH - 35;
        if (yPos > signatureY - 20) {
            doc.addPage();
            pageCounter++;
            addFooter(pageCounter);
            yPos = 20;
        }
        const lineLength = 70;
        const recommenderX = 30;
        const applicatorX = pageW - 30 - lineLength;
        doc.setLineWidth(0.5);
        doc.line(recommenderX, signatureY, recommenderX + lineLength, signatureY);
        doc.line(applicatorX, signatureY, applicatorX + lineLength, signatureY);
        doc.setFontSize(10);
        doc.text("Recomendante", recommenderX + (lineLength / 2), signatureY + 5, { align: 'center' });
        doc.text("Aplicador", applicatorX + (lineLength / 2), signatureY + 5, { align: 'center' });
        
        if (this.state.parentState.generatedHeatmaps.length > 0) {
             UIManager.setLoading(true, false, 'A anexar mapas...');
             doc.addPage();
             pageCounter++;
             addFooter(pageCounter);

             doc.setFontSize(18).setFont(undefined, 'bold');
             doc.text('Mapas de Calor de Referência', pageW / 2, 20, { align: 'center' });
             
             const margin = 15;
             const nCols = 3;
             const gap = 5;
             const contentW = pageW - (margin * 2);
             const imgW = (contentW - (gap * (nCols - 1))) / nCols;
             const imgH = imgW * 0.75;
             const titleH = 8;
             const blockH = imgH + titleH;

             let x = margin;
             let y = 30;

             this.state.parentState.generatedHeatmaps.forEach((heatmap, index) => {
                if (y + blockH > pageH - margin - 10) { // Margem para rodapé
                    doc.addPage();
                    pageCounter++;
                    addFooter(pageCounter);
                    y = 20;
                    x = margin;
                    doc.setFontSize(18).setFont(undefined, 'bold');
                    doc.text('Mapas de Calor de Referência (cont.)', pageW / 2, y, { align: 'center' });
                    y += 10;
                }
                doc.setFontSize(8).setFont(undefined, 'bold');
                doc.text(heatmap.name, x, y);
                doc.addImage(heatmap.imageUrl, 'PNG', x, y + 2, imgW, imgH);

                x += imgW + gap;
                if ((index + 1) % nCols === 0) {
                    x = margin;
                    y += blockH + gap;
                }
             });
        }

        doc.save('Weedtrack_Bula_Completa.pdf');
        UIManager.setLoading(false);
    },

    drawRecommendationBlock(doc, startY, title, areaInfo, pesticides, observations, image) {
        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();
        let currentY = startY;

        if (currentY > 250) {
            doc.addPage();
            // Adicionar footer na nova página (se precisar)
            currentY = 20;
        }

        if (image) {
            const contentW = pageW - 30;
            const imgH = contentW * 0.75;
            if (currentY + imgH + 10 > pageH - 20) {
                doc.addPage();
                // Adicionar footer
                currentY = 20;
            }
            doc.addImage(image, 'JPEG', 15, currentY, contentW, imgH);
            currentY += imgH + 10;
        }

        doc.setFontSize(14).setFont(undefined, 'bold');
        doc.text(title, 15, currentY);
        doc.setFontSize(10).setFont(undefined, 'normal');
        doc.text(areaInfo.replace(/<[^>]*>/g, '').replace(/\s\s+/g, ' '), 15, currentY + 6);

        const tableBody = [];
        const tankCapacity = parseFloat(this.dom.tankCapacity.value) || 0;
        const flowRate = parseFloat(this.dom.flowRate.value) || 0;
        const areaMatch = areaInfo.match(/(\d+\.?\d*)\s*ha/);
        const area = areaMatch ? parseFloat(areaMatch[1]) : 0;

        let haPerTank = 0, tanksNeeded = 0, fullTanks = 0, partialTankRatio = 0;
        if (tankCapacity > 0 && flowRate > 0 && area > 0) {
            haPerTank = tankCapacity / flowRate;
            tanksNeeded = area / haPerTank;
            fullTanks = Math.floor(tanksNeeded);
            partialTankRatio = tanksNeeded - fullTanks;
        }
        
        const waterPartial = partialTankRatio > 0 ? (partialTankRatio * tankCapacity).toFixed(2) + ' L' : '-';
        tableBody.push(['Água', '-', fullTanks > 0 ? tankCapacity.toFixed(2) + ' L' : '-', waterPartial, (area * flowRate).toFixed(2) + ' L']);

        pesticides.forEach(p => {
            const dose = parseFloat(p.dose) || 0;
            const unitSuffix = p.unit.startsWith('L') ? ' L' : ' Kg';
            const qtyFull = fullTanks > 0 && haPerTank > 0 ? (dose * haPerTank).toFixed(2) + unitSuffix : '-';
            const qtyPartial = partialTankRatio > 0 && haPerTank > 0 ? (dose * partialTankRatio * haPerTank).toFixed(2) + unitSuffix : '-';
            tableBody.push([p.name, `${p.dose} ${p.unit}`, qtyFull, qtyPartial, (dose * area).toFixed(2) + unitSuffix]);
        });
        
        doc.autoTable({
            head: [['Produto', 'Dose', 'Qtd / tanque', 'Qtd / tanque parcial', 'Total']],
            body: tableBody,
            startY: currentY + 12, theme: 'grid', margin: { left: 15, right: 15 },
            styles: { fontSize: 8 }, headStyles: { fillColor: [22, 160, 133], fontStyle: 'bold' }
        });
        let finalY = doc.lastAutoTable.finalY;

        if (observations) {
            finalY += 6;
            doc.setFontSize(10).setFont(undefined, 'bold');
            doc.text("Observações:", 15, finalY);
            finalY += 5;
            doc.setFontSize(9).setFont(undefined, 'normal');
            const obsLines = doc.splitTextToSize(observations, pageW - 30);
            doc.text(obsLines, 15, finalY);
            finalY += obsLines.length * 4;
        }
        return finalY;
    },
};