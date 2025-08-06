document.addEventListener('DOMContentLoaded', () => {
    // --- CONSTANTES ---
    const GOOGLE_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1Y7tIvUoYJHr4QwSRGSkYTTh22c5lxwGMcHIKyckU3KA/export?format=csv&gid=89622085';
    const LOCAL_PRODUCTS_PATH = 'data/produtos.csv';
    const LOCAL_NOTES_PATH = 'data/notas.xlsx';

    // --- SELETORES DO DOM ---
    const operatingModeRadios = document.querySelectorAll('input[name="operating-mode"]');
    const onlineOptionsDiv = document.getElementById('online-options');
    const offlineOptionsDiv = document.getElementById('offline-options');
    const loadOfflineDataBtn = document.getElementById('load-offline-data-btn');
    const notesFileInput = document.getElementById('notes-file'); // Online mode notes
    const notesSelect = document.getElementById('notes-select');
    const searchNoteInput = document.getElementById('search-note-input'); // Novo seletor
    const barcodeInput = document.getElementById('barcode-input');
    const itemsTableBody = document.querySelector('#items-table tbody');

    // New selectors for note details
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
    notesFileInput.addEventListener('change', handleNotesFile); // Only for online mode
    notesSelect.addEventListener('change', handleNoteSelection);
    searchNoteInput.addEventListener('input', filterNotes); // Novo ouvinte
    barcodeInput.addEventListener('keyup', handleBarcodeScan);
    itemsTableBody.addEventListener('click', handleTableClick);

    // --- FUNÇÕES ---

    function initialize() {
        handleModeChange(); // Set initial view based on the checked radio
    }

    function handleModeChange() {
        const selectedMode = document.querySelector('input[name="operating-mode"]:checked').value;
        resetConferenceState();

        if (selectedMode === 'online') {
            onlineOptionsDiv.style.display = 'block';
            offlineOptionsDiv.style.display = 'none';
            // Automatically load products from URL
            loadProductsFromUrl();
        } else { // Offline mode
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
        itemsTableBody.innerHTML = '';
        barcodeInput.disabled = true;
        barcodeInput.value = '';
        noteDetailsDisplay.style.display = 'none'; // Oculta os detalhes da nota
        noteInfoCombinedSpan.textContent = '';
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
            alert('Base de produtos online carregada com sucesso!');
        } catch (error) {
            console.error('Falha ao carregar produtos da URL:', error);
            alert('Não foi possível carregar a base de produtos online. Verifique a conexão e a URL.');
        }
    }

    async function loadOfflineData() {
        try {
            // 1. Carregar base de produtos local
            const productsResponse = await fetch(LOCAL_PRODUCTS_PATH);
            if (!productsResponse.ok) throw new Error(`Arquivo não encontrado: ${LOCAL_PRODUCTS_PATH}`);
            const productsCsv = await productsResponse.text();
            productDatabase = csvToJson(productsCsv);
            console.log("Base de produtos local carregada.");

            // 2. Carregar notas locais
            const notesResponse = await fetch(LOCAL_NOTES_PATH);
            if (!notesResponse.ok) throw new Error(`Arquivo não encontrado: ${LOCAL_NOTES_PATH}`);
            const notesData = await notesResponse.arrayBuffer();
            const workbook = XLSX.read(notesData, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const json = XLSX.utils.sheet_to_json(worksheet);
            
            allNotesData = json.filter(row => row.nota_fiscal && row.codigo_produto);
            console.log('Dados das notas locais carregados.');

            alert('Dados locais carregados com sucesso!');
            populateNotesSelect();

        } catch (error) {
            console.error('Erro ao carregar dados locais:', error);
            alert(`Falha ao carregar dados locais. Verifique se os arquivos 'data/produtos.csv' e 'data/notas.xlsx' existem e estão no formato correto.\n\nDetalhe: ${error.message}`);
            resetConferenceState();
        }
    }

    function handleNotesFile(event) { // For ONLINE mode
        const file = event.target.files[0];
        if (!file) return;

        if (productDatabase.length === 0) {
            alert('A base de produtos online ainda está sendo carregada ou falhou. Tente novamente em alguns segundos.');
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
                alert('Arquivo de notas carregado com sucesso!');
            } catch (error) {
                console.error('Erro ao ler o arquivo .xlsx:', error);
                alert('Ocorreu um erro ao ler o arquivo de notas. Verifique o formato.');
            }
        };
        reader.readAsArrayBuffer(file);
    }

    function populateNotesSelect() {
        // Habilitar o campo de busca, pois agora temos notas para filtrar.
        searchNoteInput.disabled = false;
        // Limpar o campo de busca para garantir que a lista completa seja exibida inicialmente.
        searchNoteInput.value = '';
        // Chamar a função de filtro para popular o select com todas as notas.
        filterNotes();

        if (allNotesData.length === 0) {
            notesSelect.innerHTML = '<option>Nenhuma nota encontrada</option>';
            notesSelect.disabled = true;
            searchNoteInput.disabled = true; // Desabilitar se não houver notas
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
            // Cria um texto pesquisável para cada nota
            const noteInfo = allNotesData.find(item => item.nota_fiscal === noteNumber);
            const searchableText = `nota fiscal ${noteNumber} ${noteInfo.razao_social_cliente || ''} ${noteInfo.cnpj_cliente || ''}`.toLowerCase();
            return searchableText.includes(searchTerm);
        });

        const currentSelectedValue = notesSelect.value;
        notesSelect.innerHTML = ''; // Limpa as opções atuais

        if (filteredNotes.length === 0) {
            notesSelect.innerHTML = '<option value="">Nenhuma nota corresponde à busca</option>';
        } else {
            notesSelect.innerHTML = '<option value="">Selecione uma nota</option>';
            filteredNotes.forEach(noteNumber => {
                const option = document.createElement('option');
                option.value = noteNumber;
                // Adiciona mais detalhes à opção para melhor identificação
                const noteInfo = allNotesData.find(item => item.nota_fiscal === noteNumber);
                option.textContent = `NF ${noteNumber} - ${noteInfo.razao_social_cliente || 'Cliente Desconhecido'}`;
                notesSelect.appendChild(option);
            });
        }

        // Tenta manter a seleção anterior se ainda estiver na lista filtrada
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
        if (!selectedNote) {
            itemsTableBody.innerHTML = '';
            barcodeInput.disabled = true;
            noteDetailsDisplay.style.display = 'none'; // Esconde os detalhes se nenhuma nota for selecionada
            return;
        }

        const itemsForNote = allNotesData.filter(item => String(item.nota_fiscal) == String(selectedNote));
        currentNoteItems = groupNoteItems(itemsForNote);
        
        // Encontra os detalhes da nota (pega o primeiro item, já que os detalhes são os mesmos para todos os itens da mesma nota)
        const noteDetails = itemsForNote.length > 0 ? itemsForNote[0] : null;

        if (noteDetails) {
            const empresa = noteDetails.empresa || 'N/A';
            const cliente = noteDetails.razao_social_cliente || 'N/A';
            const cnpj = noteDetails.cnpj_cliente || 'N/A';
            noteInfoCombinedSpan.textContent = `EMP: ${empresa} - Cliente: ${cliente} - CNPJ: ${cnpj}`;
            noteDetailsDisplay.style.display = 'block'; // Exibe os detalhes da nota
        } else {
            noteDetailsDisplay.style.display = 'none';
        }

        displayNoteItems();
        barcodeInput.disabled = false;
        barcodeInput.focus();
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
                <td><button class="btn-undo" data-codigo_produto="${item.codigo_produto}">Desfazer</button></td>
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
            alert('Produto não encontrado na base de dados! Verifique o código de barras.');
            barcodeInput.value = '';
            return;
        }

        const productCodeFromDb = String(productInfo.codigo_produto).trim();
        const itemInNote = currentNoteItems.find(item => String(item.codigo_produto).trim() === productCodeFromDb);

        if (!itemInNote) {
            alert(`Produto com código ${productCodeFromDb} não foi encontrado na nota fiscal selecionada.`);
            barcodeInput.value = '';
            return;
        }

        // Lógica de contagem automática
        const isBox = String(productInfo.ean14).trim() === barcode && productInfo.multiplo > 1;
        const quantityToAdd = isBox ? parseInt(productInfo.multiplo, 10) : 1;

        // --- NOVA VERIFICAÇÃO ---
        const futureQuantity = itemInNote.conferido + quantityToAdd;

        if (futureQuantity > itemInNote.quantidade_total) {
            const remaining = itemInNote.quantidade_total - itemInNote.conferido;
            alert(`Atenção: Leitura excede a quantidade da nota!\nItem: ${itemInNote.descricao_produto}\nRestam apenas: ${remaining} unidades.`);
            barcodeInput.value = '';
            return;
        }

        itemInNote.conferido = futureQuantity; // Usa o valor já calculado
        updateTableRow(itemInNote);

        // --- LÓGICA DE FOCO AUTOMÁTICO E DESTAQUE ---
        const row = itemsTableBody.querySelector(`tr[data-codigo_produto="${itemInNote.codigo_produto}"]`);
        if (row) {
            // Rola a linha para o centro da área visível
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });

            // Adiciona a classe de destaque e a remove após um tempo
            row.classList.add('highlight');
            setTimeout(() => {
                row.classList.remove('highlight');
            }, 2000);
        }
        // --- FIM DA LÓGICA DE FOCO ---

        barcodeInput.value = '';
        barcodeInput.focus();
    }

    function updateTableRow(item) {
        const row = itemsTableBody.querySelector(`tr[data-codigo_produto="${item.codigo_produto}"]`);
        if (!row) return;

        const qtyCell = row.querySelector('.conferido-qty');
        const statusCell = row.querySelector('.status');

        qtyCell.textContent = item.conferido;
        row.classList.remove('status-pending', 'status-partial', 'status-confirmed');

        if (item.conferido >= item.quantidade_total) {
            statusCell.textContent = 'Conferido';
            row.classList.add('status-confirmed');
        } else if (item.conferido > 0) {
            statusCell.textContent = 'Parcial';
            row.classList.add('status-partial');
        } else {
            statusCell.textContent = 'Pendente';
            row.classList.add('status-pending');
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
            itemInNote.conferido -= 1; // Still the simple version
            updateTableRow(itemInNote);
        } else {
            alert("Não há o que desfazer para este item.");
        }
    }
});