document.addEventListener('DOMContentLoaded', () => {
    // --- CONSTANTES ---
    const GOOGLE_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1Y7tIvUoYJHr4QwSRGSkYTTh22c5lxwGMcHIKyckU3KA/export?format=csv&gid=89622085';
    const LOCAL_PRODUCTS_PATH = 'data/produtos.csv';
    const LOCAL_NOTES_PATH = 'data/notas.xlsx';

    // --- SELETORES DO DOM ---
    const alertContainer = document.getElementById('alert-container');
    const operatingModeRadios = document.querySelectorAll('input[name="operating-mode"]');
    const onlineOptionsDiv = document.getElementById('online-options');
    const offlineOptionsDiv = document.getElementById('offline-options');
    const loadOfflineDataBtn = document.getElementById('load-offline-data-btn');
    const notesFileInput = document.getElementById('notes-file');
    const notesSelect = document.getElementById('notes-select');
    const searchNoteInput = document.getElementById('search-note-input');
    const barcodeInput = document.getElementById('barcode-input');
    const itemsTableBody = document.querySelector('#items-table tbody');
    const finalizeNoteBtn = document.getElementById('finalize-note-btn');
    const noteDetailsDisplay = document.getElementById('note-details-display');
    const noteInfoCombinedSpan = document.getElementById('note-info-combined');

    // --- ARMAZENAMENTO DE DADOS ---
    let productDatabase = [];
    let allNotesData = [];
    let currentNoteItems = [];

    // --- INICIALIZAÇÃO ---
    initialize();

    // --- OUVINTES DE EVENTOS ---
    operatingModeRadios.forEach(radio => radio.addEventListener('change', handleModeChange));
    loadOfflineDataBtn.addEventListener('click', loadOfflineData);
    notesFileInput.addEventListener('change', handleNotesFile);
    notesSelect.addEventListener('change', handleNoteSelection);
    searchNoteInput.addEventListener('input', filterNotes);
    barcodeInput.addEventListener('keyup', handleBarcodeScan);
    itemsTableBody.addEventListener('click', handleTableClick);
    finalizeNoteBtn.addEventListener('click', finalizeNote);

    // --- FUNÇÕES ---

    function showAlert(message, type = 'info', duration = 5000) {
        const alertEl = document.createElement('div');
        alertEl.className = `alert alert-${type} alert-dismissible fade show`;
        alertEl.role = 'alert';
        alertEl.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        alertContainer.appendChild(alertEl);

        setTimeout(() => {
            alertEl.classList.remove('show');
            setTimeout(() => alertEl.remove(), 150); // Espera a transição de fade out
        }, duration);
    }

    function initialize() {
        handleModeChange();
    }

    function handleModeChange() {
        const selectedMode = document.querySelector('input[name="operating-mode"]:checked').value;
        resetConferenceState();
        if (selectedMode === 'online') {
            onlineOptionsDiv.style.display = 'block';
            offlineOptionsDiv.style.display = 'none';
            loadProductsFromUrl();
        } else {
            onlineOptionsDiv.style.display = 'none';
            offlineOptionsDiv.style.display = 'block';
        }
    }

    function resetConferenceState() {
        productDatabase = [];
        allNotesData = [];
        currentNoteItems = [];
        notesSelect.innerHTML = '<option>Aguardando dados...</option>';
        notesSelect.disabled = true;
        searchNoteInput.disabled = true;
        searchNoteInput.value = '';
        itemsTableBody.innerHTML = '';
        barcodeInput.disabled = true;
        barcodeInput.value = '';
        noteDetailsDisplay.style.display = 'none';
        noteInfoCombinedSpan.textContent = '';
        finalizeNoteBtn.style.display = 'none';
    }

    function csvToJson(csv) {
        const lines = csv.trim().split('\n');
        const result = [];
        const headers = lines[0].split(',').map(h => h.trim());
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i]) continue;
            const obj = {};
            const currentline = lines[i].split(',');
            for (let j = 0; j < headers.length; j++) {
                obj[headers[j]] = currentline[j] ? currentline[j].trim() : '';
            }
            result.push(obj);
        }
        return result;
    }

    async function loadProductsFromUrl() {
        try {
            const response = await fetch(GOOGLE_SHEET_URL);
            if (!response.ok) throw new Error(`Erro na rede: ${response.statusText}`);
            const csvData = await response.text();
            productDatabase = csvToJson(csvData);
            console.log("Base de produtos carregada da URL.");
            showAlert('Base de produtos online carregada com sucesso!', 'success');
        } catch (error) {
            console.error('Falha ao carregar produtos da URL:', error);
            showAlert('Não foi possível carregar a base de produtos online. Verifique a conexão e a URL.', 'danger');
        }
    }

    async function loadOfflineData() {
        try {
            const productsResponse = await fetch(LOCAL_PRODUCTS_PATH);
            if (!productsResponse.ok) throw new Error(`Arquivo não encontrado: ${LOCAL_PRODUCTS_PATH}`);
            const productsCsv = await productsResponse.text();
            productDatabase = csvToJson(productsCsv);
            console.log("Base de produtos local carregada.");

            const notesResponse = await fetch(LOCAL_NOTES_PATH);
            if (!notesResponse.ok) throw new Error(`Arquivo não encontrado: ${LOCAL_NOTES_PATH}`);
            const notesData = await notesResponse.arrayBuffer();
            const workbook = XLSX.read(notesData, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const json = XLSX.utils.sheet_to_json(worksheet);
            
            allNotesData = json.filter(row => row.nota_fiscal && row.codigo_produto);
            console.log('Dados das notas locais carregados.');

            showAlert('Dados locais carregados com sucesso!', 'success');
            populateNotesSelect();

        } catch (error) {
            console.error('Erro ao carregar dados locais:', error);
            showAlert(`Falha ao carregar dados locais: ${error.message}`,'danger');
            resetConferenceState();
        }
    }

    function handleNotesFile(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (productDatabase.length === 0) {
            showAlert('A base de produtos online ainda está sendo carregada ou falhou. Tente novamente.', 'warning');
            event.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const json = XLSX.utils.sheet_to_json(worksheet);
                
                allNotesData = json.filter(row => row.nota_fiscal && row.codigo_produto);
                console.log('Dados das notas (online) carregados.');
                populateNotesSelect();
                showAlert('Arquivo de notas carregado com sucesso!', 'success');
            } catch (error) {
                console.error('Erro ao ler o arquivo .xlsx:', error);
                showAlert('Ocorreu um erro ao ler o arquivo de notas. Verifique o formato.', 'danger');
            }
        };
        reader.readAsArrayBuffer(file);
    }

    function populateNotesSelect() {
        searchNoteInput.disabled = false;
        searchNoteInput.value = '';
        filterNotes();

        if (allNotesData.length === 0) {
            notesSelect.innerHTML = '<option>Nenhuma nota encontrada</option>';
            notesSelect.disabled = true;
            searchNoteInput.disabled = true;
            return;
        }

        notesSelect.disabled = false;
        itemsTableBody.innerHTML = '';
        barcodeInput.disabled = true;
    }

    function filterNotes() {
        const searchTerm = searchNoteInput.value.toLowerCase();
        const uniqueNoteNumbers = [...new Set(allNotesData.map(item => item.nota_fiscal))].filter(n => n);

        const filteredNotes = uniqueNoteNumbers.filter(noteNumber => {
            const noteInfo = allNotesData.find(item => item.nota_fiscal === noteNumber);
            const searchableText = `nota fiscal ${noteNumber} ${noteInfo.razao_social_cliente || ''} ${noteInfo.cnpj_cliente || ''}`.toLowerCase();
            return searchableText.includes(searchTerm);
        });

        const currentSelectedValue = notesSelect.value;
        notesSelect.innerHTML = '';

        if (filteredNotes.length === 0) {
            notesSelect.innerHTML = '<option value="">Nenhuma nota corresponde à busca</option>';
        } else {
            notesSelect.innerHTML = '<option value="">Selecione uma nota</option>';
            filteredNotes.forEach(noteNumber => {
                const option = document.createElement('option');
                option.value = noteNumber;
                const noteInfo = allNotesData.find(item => item.nota_fiscal === noteNumber);
                option.textContent = `NF ${noteNumber} - ${noteInfo.razao_social_cliente || 'Cliente Desconhecido'}`;
                notesSelect.appendChild(option);
            });
        }

        if (filteredNotes.includes(parseInt(currentSelectedValue))) {
            notesSelect.value = currentSelectedValue;
        }
    }

    function groupNoteItems(items) {
        const grouped = {};
        items.forEach(item => {
            const key = String(item.codigo_produto).trim();
            if (!grouped[key]) {
                const productDetails = productDatabase.find(p => String(p.codigo_produto).trim() === key) || {};
                grouped[key] = { 
                    ...item,
                    codigo_produto: key,
                    descricao_produto: item.descricao_produto || productDetails.descricao_produto || 'Descrição não encontrada',
                    ean13: item.ean13 || productDetails.ean13 || 'N/A',
                    referencia: item.referencia || productDetails.referencia || 'N/A',
                    quantidade_total: 0, 
                    conferido: 0 
                };
            }
            grouped[key].quantidade_total += (item.quantidade ? parseInt(item.quantidade, 10) : 1);
        });
        return Object.values(grouped);
    }

    function handleNoteSelection() {
        const selectedNote = notesSelect.value;
        finalizeNoteBtn.style.display = 'none';

        if (!selectedNote) {
            itemsTableBody.innerHTML = '';
            barcodeInput.disabled = true;
            noteDetailsDisplay.style.display = 'none';
            return;
        }

        const itemsForNote = allNotesData.filter(item => String(item.nota_fiscal) == String(selectedNote));
        currentNoteItems = groupNoteItems(itemsForNote);
        
        const noteDetails = itemsForNote.length > 0 ? itemsForNote[0] : null;

        if (noteDetails) {
            const empresa = noteDetails.empresa || 'N/A';
            const cliente = noteDetails.razao_social_cliente || 'N/A';
            const cnpj = noteDetails.cnpj_cliente || 'N/A';
            noteInfoCombinedSpan.textContent = `EMP: ${empresa} - Cliente: ${cliente} - CNPJ: ${cnpj}`;
            noteDetailsDisplay.style.display = 'block';
        } else {
            noteDetailsDisplay.style.display = 'none';
        }

        displayNoteItems();
        barcodeInput.disabled = false;
        barcodeInput.focus();
        checkIfNoteIsComplete();
    }

    function displayNoteItems() {
        itemsTableBody.innerHTML = '';
        currentNoteItems.forEach(item => {
            const row = document.createElement('tr');
            row.dataset.codigo_produto = item.codigo_produto;

            row.innerHTML = `
                <td>${item.codigo_produto}</td>
                <td>${item.referencia}</td>
                <td>${item.ean13}</td>
                <td>${item.descricao_produto}</td>
                <td>${item.quantidade_total}</td>
                <td class="conferido-qty">${item.conferido}</td>
                <td class="status"></td>
                <td><button class="btn btn-warning btn-sm btn-undo" data-codigo_produto="${item.codigo_produto}"><i class="bi bi-arrow-counterclockwise"></i></button></td>
            `;
            itemsTableBody.appendChild(row);
            updateTableRow(item);
        });
    }

    function handleBarcodeScan(event) {
        if (event.key !== 'Enter') return;
        const barcode = barcodeInput.value.trim();
        if (!barcode) return;

        const productInfo = productDatabase.find(p => String(p.ean13) === barcode || String(p.ean14) === barcode);

        if (!productInfo) {
            showAlert('Produto não encontrado na base de dados! Verifique o código de barras.', 'danger');
            barcodeInput.value = '';
            return;
        }

        const productCodeFromDb = String(productInfo.codigo_produto).trim();
        const itemInNote = currentNoteItems.find(item => String(item.codigo_produto).trim() === productCodeFromDb);

        if (!itemInNote) {
            showAlert(`Produto com código ${productCodeFromDb} não foi encontrado na nota fiscal selecionada.`, 'warning');
            barcodeInput.value = '';
            return;
        }

        const isBox = String(productInfo.ean14).trim() === barcode && productInfo.multiplo > 1;
        const quantityToAdd = isBox ? parseInt(productInfo.multiplo, 10) : 1;

        const futureQuantity = itemInNote.conferido + quantityToAdd;

        if (futureQuantity > itemInNote.quantidade_total) {
            const remaining = itemInNote.quantidade_total - itemInNote.conferido;
            showAlert(`Atenção: Leitura excede a quantidade da nota! Restam: ${remaining}.`, 'warning');
            barcodeInput.value = '';
            return;
        }

        itemInNote.conferido = futureQuantity;
        updateTableRow(itemInNote);

        const row = itemsTableBody.querySelector(`tr[data-codigo_produto="${itemInNote.codigo_produto}"]`);
        if (row) {
            row.scrollIntoView({ behavior: 'smooth', block: 'start' });
            row.classList.add('highlight');
            setTimeout(() => row.classList.remove('highlight'), 2000);
        }

        barcodeInput.value = '';
        barcodeInput.focus();
        checkIfNoteIsComplete();
    }

    function updateTableRow(item) {
        const row = itemsTableBody.querySelector(`tr[data-codigo_produto="${item.codigo_produto}"]`);
        if (!row) return;

        const qtyCell = row.querySelector('.conferido-qty');
        const statusCell = row.querySelector('.status');

        qtyCell.textContent = item.conferido;
        row.classList.remove('status-pending', 'status-partial', 'status-confirmed');
        statusCell.innerHTML = ''; // Limpa o conteúdo anterior

        if (item.conferido >= item.quantidade_total) {
            row.classList.add('table-success'); // Bootstrap success color
            statusCell.innerHTML = '<span class="badge bg-success">Conferido</span>';
        } else if (item.conferido > 0) {
            row.classList.add('table-warning'); // Bootstrap warning color
            statusCell.innerHTML = '<span class="badge bg-warning text-dark">Parcial</span>';
        } else {
            statusCell.innerHTML = '<span class="badge bg-secondary">Pendente</span>';
        }
    }

    function handleTableClick(event) {
        if (event.target.classList.contains('btn-undo')) {
            const productCode = event.target.dataset.codigo_produto;
            handleUndo(productCode);
        }
    }

    function handleUndo(productCode) {
        const itemInNote = currentNoteItems.find(item => String(item.codigo_produto) === productCode);

        if (itemInNote && itemInNote.conferido > 0) {
            itemInNote.conferido -= 1;
            updateTableRow(itemInNote);
            checkIfNoteIsComplete();
        } else {
            showAlert("Não há o que desfazer para este item.", 'info');
        }
    }

    function checkIfNoteIsComplete() {
        if (currentNoteItems.length === 0) {
            finalizeNoteBtn.style.display = 'none';
            return;
        }
        const isComplete = currentNoteItems.every(item => item.conferido >= item.quantidade_total);
        if (isComplete) {
            finalizeNoteBtn.style.display = 'block';
        } else {
            finalizeNoteBtn.style.display = 'none';
        }
    }

    function finalizeNote() {
        const noteNumber = notesSelect.value;
        showAlert(`Nota Fiscal ${noteNumber} finalizada com sucesso!`, 'success');
        itemsTableBody.innerHTML = '';
        barcodeInput.disabled = true;
        barcodeInput.value = '';
        noteDetailsDisplay.style.display = 'none';
        finalizeNoteBtn.style.display = 'none';
        notesSelect.value = ''; 
        searchNoteInput.focus(); 
    }
});