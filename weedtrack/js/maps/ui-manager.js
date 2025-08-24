// ===================================================================================
//  GERENCIADOR DA INTERFACE DO USUÁRIO (UI)
// ===================================================================================
const UIManager = {
    dom: {
        loader: document.getElementById('loader'),
        spinner: document.getElementById('spinner'),
        progressContainer: document.getElementById('progress-container'),
        progressBar: document.getElementById('progress-bar'),
        progressText: document.getElementById('progress-text'),
        toast: document.getElementById('toast'),
        toastMessage: document.getElementById('toast-message'),
        controlsPanel: document.getElementById('controls-panel'),
        menuToggleBtn: document.getElementById('menu-toggle-btn'),
        zoneModal: document.getElementById('zoneModal'),
        speciesSelect: document.getElementById('speciesSelect'),
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

    showToast(message, type = 'error') {
        this.dom.toastMessage.textContent = message;
        this.dom.toast.className = `fixed bottom-5 right-5 text-white py-3 px-5 rounded-lg shadow-xl z-[101] transition-opacity duration-300 ${type === 'info' ? 'bg-blue-600' : 'bg-red-600'}`;
        this.dom.toast.classList.remove('hidden');
        setTimeout(() => { this.dom.toast.classList.add('hidden'); }, 5000);
    },

    openZoneModal(generatedHeatmaps) {
        this.dom.speciesSelect.innerHTML = '';
        const customOption = document.createElement('option');
        customOption.value = 'personalizado';
        customOption.textContent = 'Zona Personalizada (Desenhar)';
        this.dom.speciesSelect.appendChild(customOption);

        generatedHeatmaps.forEach(h => {
            const option = document.createElement('option');
            option.value = h.name;
            option.textContent = h.name;
            this.dom.speciesSelect.appendChild(option);
        });
        this.dom.zoneModal.classList.remove('hidden');
    },
};