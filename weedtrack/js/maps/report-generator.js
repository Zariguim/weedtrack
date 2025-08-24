// ===================================================================================
//  GERADOR DE RELATÓRIO (PDF)
// ===================================================================================
const ReportGenerator = {
    dom: {
        modal: document.getElementById('reportModal'),
        closeBtn: document.getElementById('closeReportModalBtn'),
        responsible: document.getElementById('reportResponsible'),
        description: document.getElementById('reportDescription'),
        imagesContainer: document.getElementById('reportImagesContainer'),
        uploadInput: document.getElementById('reportImageUpload'),
        generateBtn: document.getElementById('generateReportBtn'),
    },
    state: {
        parentState: null,
        reportImages: [], // { id, type, name, src, comment, included }
        logoSvgString: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2ZM12 11.5C10.62 11.5 9.5 10.38 9.5 9C9.5 7.62 10.62 6.5 12 6.5C13.38 6.5 14.5 7.62 14.5 9C14.5 10.38 13.38 11.5 12 11.5Z" fill="#47555A"/><path d="M12 6.5C10.62 6.5 9.5 7.62 9.5 9C9.5 10.38 10.62 11.5 12 11.5C13.38 11.5 14.5 10.38 14.5 9C14.5 7.62 13.38 6.5 12 6.5Z" fill="white"/><path d="M11.21 8.46938C11.3486 8.22034 11.6848 8.13836 11.9349 8.27459C12.1849 8.41083 12.2669 8.74699 12.1307 8.99694L10.9807 11.247C10.8448 11.497 10.5086 11.5789 10.2586 11.4426C9.9977 11.3064 9.91576 10.9706 11.0517 10.7202L11.21 8.46938Z" fill="#47555A"/></svg>',
    },

    init() {
        this.bindEvents();
    },

    bindEvents() {
        this.dom.closeBtn.addEventListener('click', () => this.close());
        this.dom.uploadInput.addEventListener('change', this.handleImageUpload.bind(this));
        this.dom.generateBtn.addEventListener('click', this.generatePdf.bind(this));
    },

    open(mapasState) {
        if (!mapasState.kmlGeoJSON) {
            UIManager.showToast("Carregue um talhão primeiro para criar um relatório.", "error");
            return;
        }
        this.state.parentState = mapasState;
        this.prepareModal();
        this.dom.modal.classList.remove('hidden');
    },

    close() {
        this.dom.modal.classList.add('hidden');
    },

    prepareModal() {
        this.dom.responsible.value = '';
        this.dom.description.value = '';
        this.dom.uploadInput.value = '';
        this.state.reportImages = [];

        this.state.parentState.generatedHeatmaps.forEach(heatmap => {
            this.addImageToList({
                type: 'heatmap',
                name: heatmap.name,
                src: heatmap.imageUrl
            });
        });

        this.renderImages();
    },

    handleImageUpload(event) {
        const files = event.target.files;
        if (!files.length) return;

        Array.from(files).forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                this.addImageToList({
                    type: 'upload',
                    name: file.name,
                    src: e.target.result
                });
                this.renderImages();
            };
            reader.readAsDataURL(file);
        });
    },

    addImageToList(imageData) {
        this.state.reportImages.push({
            id: Date.now() + Math.random(),
            type: imageData.type,
            name: imageData.name,
            src: imageData.src,
            comment: '',
            included: true,
        });
    },

    renderImages() {
        this.dom.imagesContainer.innerHTML = '';
        if (this.state.reportImages.length === 0) {
            this.dom.imagesContainer.innerHTML = '<p class="col-span-full text-center text-slate-500">Nenhum mapa de calor gerado. Adicione imagens para o relatório.</p>';
        }

        this.state.reportImages.forEach(image => {
            const card = document.createElement('div');
            card.className = 'border rounded-lg p-2 flex flex-col gap-2';
            card.innerHTML = `
                <div class="flex items-center justify-between">
                    <label class="flex items-center gap-2 text-sm font-medium cursor-pointer">
                        <input type="checkbox" data-id="${image.id}" class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" ${image.included ? 'checked' : ''}>
                        Incluir
                    </label>
                    <span class="text-xs text-slate-500 truncate" title="${image.name}">${image.name}</span>
                </div>
                <img src="${image.src}" class="w-full h-auto aspect-video object-cover rounded">
                <textarea data-id="${image.id}" class="w-full p-1 border border-gray-300 rounded-md text-xs" rows="2" placeholder="Adicionar comentário..." maxlength="100">${image.comment}</textarea>
            `;
            this.dom.imagesContainer.appendChild(card);
        });

        this.dom.imagesContainer.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const img = this.state.reportImages.find(i => i.id == e.target.dataset.id);
                if (img) img.included = e.target.checked;
            });
        });
        this.dom.imagesContainer.querySelectorAll('textarea').forEach(textarea => {
            textarea.addEventListener('input', (e) => {
                const img = this.state.reportImages.find(i => i.id == e.target.dataset.id);
                if (img) img.comment = e.target.value;
            });
        });
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
        const includedImages = this.state.reportImages.filter(img => img.included);
        if (includedImages.length === 0) {
            UIManager.showToast("Nenhuma imagem selecionada para o relatório.", "error");
            return;
        }

        UIManager.setLoading(true, false, 'A carregar imagens para o relatório...');

        const imagePromises = includedImages.map(imgData => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve({ ...imgData, element: img });
                img.onerror = reject;
                img.src = imgData.src;
            });
        });

        try {
            const loadedImages = await Promise.all(imagePromises);
            const logoPng = await this.convertSvgToPngBase64(this.state.logoSvgString, 24, 24);

            UIManager.setLoading(true, false, 'A gerar Relatório PDF...');
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('p', 'mm', 'a4');
            const pageW = doc.internal.pageSize.getWidth();
            const pageH = doc.internal.pageSize.getHeight();
            const margin = 15;
            let yPos = margin;

            const addFooter = (pageNumber) => {
                doc.setFontSize(8);
                doc.setTextColor(150);
                
                doc.addImage(logoPng, 'PNG', margin, pageH - 12, 5, 5);
                doc.text('Weedtrack', margin + 7, pageH - 8.5);
                
                doc.setFontSize(7);
                doc.setTextColor(180);
                doc.text('Precisão no diagnóstico, resultado no manejo.', margin + 25, pageH - 8.5);

                doc.text(`${pageNumber}`, pageW - margin, pageH - 8.5, { align: 'right' });
            };
            
            addFooter(1);

            doc.setFontSize(22).setFont(undefined, 'bold').setTextColor(0);
            doc.text('Relatório de Monitoramento', pageW / 2, yPos, { align: 'center' });
            yPos += 15;
            
            doc.setFontSize(11).setFont(undefined, 'normal');
            const responsible = this.dom.responsible.value.trim();
            const talhaoName = this.state.parentState.kmlDatabase.find(t => t.id == MapasApp.dom.kmlSelect.value)?.nome_talhao || 'N/A';
            const fazendaName = MapasApp.dom.fazendaSelect.options[MapasApp.dom.fazendaSelect.selectedIndex].text;
            
            if (responsible) {
                doc.text(`Responsável: ${responsible}`, margin, yPos);
            }
            doc.text(`Fazenda: ${fazendaName}`, margin, yPos + (responsible ? 5 : 0));
            doc.text(`Talhão: ${talhaoName}`, margin, yPos + (responsible ? 10 : 5));
            doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, pageW - margin, yPos, { align: 'right' });
            yPos += (responsible ? 20 : 15);

            const description = this.dom.description.value.trim();
            if (description) {
                doc.setFontSize(12).setFont(undefined, 'bold');
                doc.text('Descrição', margin, yPos);
                yPos += 6;
                doc.setFontSize(10).setFont(undefined, 'normal');
                const descLines = doc.splitTextToSize(description, pageW - (margin * 2));
                doc.text(descLines, margin, yPos);
                yPos += descLines.length * 5 + 10;
            }

            const nCols = 3;
            const gap = 5;
            const contentW = pageW - (margin * 2);
            const frameW = (contentW - (gap * (nCols - 1))) / nCols;
            const frameH = frameW * 1.2;
            const titleH = 8;
            const bottomBorderH = frameW * 0.25;
            const innerPadding = 3;
            const imgAreaW = frameW - (innerPadding * 2);
            const imgAreaH = frameH - bottomBorderH - innerPadding;
            const blockH = frameH + titleH;
            let col = 0;
            let pageCounter = 1;

            for (const image of loadedImages) {
                if (yPos + blockH > pageH - margin - 10) { 
                    pageCounter++;
                    doc.addPage();
                    addFooter(pageCounter);
                    yPos = margin;
                    col = 0;
                }

                const x = margin + (col * (frameW + gap));
                let currentBlockY = yPos;

                if (image.type === 'heatmap') {
                    doc.setFontSize(7).setFont(undefined, 'bold').setTextColor(80);
                    doc.text(image.name, x + frameW / 2, currentBlockY, { align: 'center', maxWidth: frameW });
                }
                currentBlockY += titleH - 4;

                doc.setFillColor(255, 255, 255);
                doc.setDrawColor(220, 220, 220);
                doc.rect(x, currentBlockY, frameW, frameH, 'FD');

                const imgNaturalW = image.element.naturalWidth;
                const imgNaturalH = image.element.naturalHeight;
                const ratio = Math.min(imgAreaW / imgNaturalW, imgAreaH / imgNaturalH);
                const newW = imgNaturalW * ratio;
                const newH = imgNaturalH * ratio;
                const imgX = x + (frameW - newW) / 2;
                const imgY = currentBlockY + innerPadding + (imgAreaH - newH) / 2;
                
                const format = image.src.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG';
                doc.addImage(image.element, format, imgX, imgY, newW, newH);

                if (image.comment.trim()) {
                    doc.setFontSize(8).setFont('helvetica', 'italic').setTextColor(100);
                    const commentLines = doc.splitTextToSize(image.comment, frameW - 8);
                    doc.text(commentLines, x + frameW / 2, currentBlockY + frameH - bottomBorderH + 6, { align: 'center' });
                }
                
                col++;
                if (col >= nCols) {
                    col = 0;
                    yPos += blockH + gap;
                }
            }
            
            doc.save(`Relatorio_${fazendaName.replace(/\s/g, '_')}_${talhaoName.replace(/\s/g, '_')}.pdf`);
        } catch (err) {
            console.error("Erro ao gerar PDF:", err);
            UIManager.showToast("Erro ao processar uma das imagens para o relatório.", "error");
        } finally {
            UIManager.setLoading(false);
            this.close();
        }
    },
};