/* ============================================
   RIO INVISÍVEL — script.js
   ============================================
   Este arquivo:
   1. Cria o mapa usando o estilo que você fez no MapTiler
   2. Carrega os dados dos locais/NPCs/facções dos arquivos JSON
   3. Adiciona os pins (marcadores) no mapa — incluindo o leque
      de pins empilhados na mesma coordenada
   4. Cria os pop-ups de cada pin (com carrossel de fotos)
   5. Monta os filtros e a barra lateral de descobertas

   Pra adicionar um novo local, NPC ou facção, edite o arquivo
   JSON correspondente na pasta "dados/" — não precisa mexer
   neste arquivo.
*/

// ------------------------------------------
// 1. CRIAÇÃO DO MAPA
// ------------------------------------------

// TROQUE AQUI pela URL do estilo que você criou no MapTiler.
// Você encontra essa URL no painel do MapTiler, na aba "Use"
// do seu mapa — algo como:
// https://api.maptiler.com/maps/SEU-MAPA/style.json?key=SUA-CHAVE
const URL_DO_ESTILO = 'https://api.maptiler.com/maps/019f77ad-020a-79bf-a69c-b360913a080a/style.json?key=iqVPpUISizX2hI8D7RoK';

const map = new maplibregl.Map({
  container: 'mapa',            // precisa bater com o id="mapa" do index.html
  style: URL_DO_ESTILO,
  center: [-43.1729, -22.9068], // [longitude, latitude] — centro do Rio de Janeiro
  zoom: 12,
});

// Botões de zoom (+/-) e bússola, no canto superior direito.
// É um controle nativo do MapLibre — não faz parte do #ui.
map.addControl(new maplibregl.NavigationControl(), 'top-right');


// ------------------------------------------
// 2. TELA DE CARREGAMENTO
// ------------------------------------------

// Esconde a tela de "Carregando..." assim que o mapa terminar
// de desenhar o estilo pela primeira vez.
map.on('load', () => {
  document.getElementById('carregando').style.display = 'none';
});

// Se algo der errado (chave inválida, sem internet, URL errada),
// troca a mensagem de carregamento por um aviso, em vez de
// deixar a tela de carregando girando pra sempre.
map.on('error', (evento) => {
  console.error('Erro ao carregar o mapa:', evento.error);
  document.getElementById('carregando').innerHTML =
    '<p>Não foi possível carregar o mapa. Verifique sua conexão ou a chave do MapTiler.</p>';
});


// ------------------------------------------
// 3. CARREGAMENTO DOS DADOS (arquivos JSON)
// ------------------------------------------

// Cada arquivo é uma LISTA de objetos com:
//   titulo       (texto)
//   descricao    (texto)
//   coordenadas  (opcional — [longitude, latitude]. Sem isso,
//                 o item não vira pin no mapa, só aparece na
//                 barra lateral — bom pra NPCs ambulantes ou
//                 locais em outros planos de existência)
//   imagens      (opcional — LISTA de caminhos de foto, tipo
//                 ["assets/imagens/foto1.png", "assets/imagens/foto2.png"].
//                 A primeira da lista é sempre a "capa", usada
//                 no pin. Se tiver mais de uma, aparecem
//                 setinhas pra passar entre elas no popup.)
//
// Repare que NÃO escrevemos "categoria" dentro do JSON — ela é
// definida aqui embaixo, uma vez, de acordo com o arquivo.
const ARQUIVOS_DE_DADOS = [
  { arquivo: 'dados/locais.json', categoria: 'Local' },
  { arquivo: 'dados/npcs.json', categoria: 'NPC' },
  { arquivo: 'dados/faccoes.json', categoria: 'Faccao' },
];

// Busca todos os arquivos JSON ao mesmo tempo, junta tudo numa
// lista só, e devolve ela (com a categoria já preenchida em
// cada item).
async function carregarLocais() {
  const listas = await Promise.all(
    ARQUIVOS_DE_DADOS.map(async ({ arquivo, categoria }) => {
      const resposta = await fetch(arquivo);
      if (!resposta.ok) {
        throw new Error(`Não consegui carregar "${arquivo}" (status ${resposta.status})`);
      }
      const itens = await resposta.json();
      return itens.map((item) => ({ ...item, categoria }));
    })
  );

  return listas.flat();
}


// ------------------------------------------
// 4. LIGHTBOX (ampliar foto, com setinhas pra navegar)
// ------------------------------------------

const lightbox = document.getElementById('lightbox');
const lightboxImagem = document.getElementById('lightbox-imagem');
const lightboxAnterior = document.getElementById('lightbox-anterior');
const lightboxProxima = document.getElementById('lightbox-proxima');

// Guarda a lista de fotos do local atual e qual delas está
// sendo exibida, pra saber o que mostrar quando clicar nas
// setinhas de "anterior"/"próxima".
let lightboxImagens = [];
let lightboxIndiceAtual = 0;

function atualizarImagemLightbox(alt) {
  lightboxImagem.src = lightboxImagens[lightboxIndiceAtual];
  if (alt) {
    lightboxImagem.alt = alt;
  }
  // Só mostra as setinhas se tiver mais de uma foto pra navegar.
  const temVarias = lightboxImagens.length > 1;
  lightboxAnterior.hidden = !temVarias;
  lightboxProxima.hidden = !temVarias;
}

function abrirLightbox(imagens, indiceInicial, alt) {
  lightboxImagens = imagens;
  lightboxIndiceAtual = indiceInicial || 0;
  atualizarImagemLightbox(alt);
  lightbox.classList.add('ativo');
}

function fecharLightbox() {
  lightbox.classList.remove('ativo');
}

function irParaFotoAnteriorLightbox() {
  lightboxIndiceAtual = (lightboxIndiceAtual - 1 + lightboxImagens.length) % lightboxImagens.length;
  atualizarImagemLightbox();
}

function irParaProximaFotoLightbox() {
  lightboxIndiceAtual = (lightboxIndiceAtual + 1) % lightboxImagens.length;
  atualizarImagemLightbox();
}

lightboxAnterior.addEventListener('click', (evento) => {
  evento.stopPropagation(); // não deixa isso também fechar o lightbox
  irParaFotoAnteriorLightbox();
});

lightboxProxima.addEventListener('click', (evento) => {
  evento.stopPropagation();
  irParaProximaFotoLightbox();
});

// Clicar em qualquer lugar do fundo escuro fecha o lightbox.
lightbox.addEventListener('click', fecharLightbox);

// Guarda as funções de "trocar foto" do popup que estiver
// aberto NESTE momento (preenchido/limpo lá na seção 7, onde
// os popups são criados). É assim que o teclado sabe qual
// carrossel navegar quando o lightbox não está aberto.
let controladorFotoPopupAtual = null;

// Setas do teclado (← →) navegam as fotos: do lightbox, se ele
// estiver aberto; senão, do popup aberto no momento (se ele
// tiver mais de uma foto). Tecla ESC fecha lightbox/barra lateral.
document.addEventListener('keydown', (evento) => {
  if (evento.key === 'Escape') {
    fecharLightbox();
    fecharBarraLateral();
    return;
  }

  if (evento.key !== 'ArrowLeft' && evento.key !== 'ArrowRight') {
    return;
  }

  const indoPraEsquerda = evento.key === 'ArrowLeft';

  if (lightbox.classList.contains('ativo')) {
    if (indoPraEsquerda) {
      irParaFotoAnteriorLightbox();
    } else {
      irParaProximaFotoLightbox();
    }
  } else if (controladorFotoPopupAtual) {
    if (indoPraEsquerda) {
      controladorFotoPopupAtual.anterior();
    } else {
      controladorFotoPopupAtual.proxima();
    }
  }
});


// ------------------------------------------
// 5. FUNÇÕES AUXILIARES (usadas em várias seções)
// ------------------------------------------

// Transforma "Local", "NPC", "Facção" etc. num formato seguro
// pra usar como nome de classe CSS: tudo minúsculo e sem
// acento (--faccao em vez de --facção). Usada tanto pro pin
// quanto pro badge do popup, pra garantir que os dois usem
// exatamente a mesma regra e nunca fiquem fora de sincronia.
function paraClasseCss(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// Normaliza um texto pra comparar na busca: tudo minúsculo e
// sem acento (assim "café" bate com "cafe"). Mesma lógica de
// paraClasseCss, só que aplicada a frases inteiras, não a nomes
// de categoria.
function normalizarTexto(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// Um local "tem imagens" se o campo existir e não estiver vazio.
function temImagens(local) {
  return Array.isArray(local.imagens) && local.imagens.length > 0;
}

// Em qual "camada" cada categoria fica quando os pins se
// sobrepõem no mapa — número maior fica por CIMA, e é também
// quem "representa" o grupo quando várias categorias dividem a
// mesma coordenada. Se criar uma categoria nova e não colocar
// ela aqui, ela fica no meio (camada 2) por padrão.
const CAMADA_POR_CATEGORIA = {
  local: 3,
  faccao: 2,
  npc: 1,
};

// Coordenadas (dentro do viewBox 0-100 da moldura SVG dos pins)
// da PONTA e dos dois "vales" ao lado de cada rumo — são
// exatamente os mesmos pontos usados pra desenhar a estrela
// de pedra lá no style.css. Usamos eles de novo aqui pra
// recolorir uma ponta inteira (não só um pontinho em cima).
const PONTAS_DA_MOLDURA = [
  [50, 2], [83.9, 16.1], [98, 50], [83.9, 83.9],
  [50, 98], [16.1, 83.9], [2, 50], [16.1, 16.1],
];
const VALES_DA_MOLDURA = [
  [63, 18.6], [81.4, 37], [81.4, 63], [63, 81.4],
  [37, 81.4], [18.6, 63], [18.6, 37], [37, 18.6],
];

// Gera um SVG (entregue via variável CSS, pra usar no ::before
// do pin) desenhando as pontas da moldura pedidas (pelos seus
// ÍNDICES, 0 a 7, na ordem N/NE/L/SE/S/SO/O/NO) em dourado —
// cada uma é o mesmo triângulo (vale-anterior → ponta →
// vale-seguinte) que forma aquela ponta na estrela de pedra,
// só que pintado por cima, dando a impressão de que a própria
// ponta mudou de cor.
//
// Usos: o pin "representante" de um grupo acende as PRIMEIRAS
// N pontas (uma por local escondido ali); já um pin DENTRO do
// leque acende só UMA ponta específica — a de número igual à
// posição dele no leque (1º pin → 1ª ponta, 2º → 2ª, etc).
function criarPontasIluminadas(indices) {
  const partes = indices.map((i) => {
    const indiceValido = ((i % 8) + 8) % 8; // sempre entre 0 e 7
    const valeAntes = VALES_DA_MOLDURA[(indiceValido - 1 + 8) % 8];
    const ponta = PONTAS_DA_MOLDURA[indiceValido];
    const valeDepois = VALES_DA_MOLDURA[indiceValido];

    return (
      `<path d='M${valeAntes[0]},${valeAntes[1]} L${ponta[0]},${ponta[1]} L${valeDepois[0]},${valeDepois[1]} Z' ` +
      `fill='%23ffd84d' stroke='%232b2822' stroke-width='1'/>`
    );
  }).join('');

  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>${partes}</svg>`;
  return `url("data:image/svg+xml,${svg.replace(/</g, '%3C').replace(/>/g, '%3E')}")`;
}

// Cria o pin que vai no mapa. Usamos DOIS elementos, um dentro
// do outro, por um motivo específico: o MapLibre escreve um
// "transform" direto no estilo do elemento que a gente entrega
// pra ele, pra posicionar o pin no mapa — isso tem prioridade
// sobre qualquer CSS nosso, inclusive a regra de ":hover" que
// faz o pin crescer. Solução: entregamos pro MapLibre um
// elemento "de fora" (embrulho) que ele pode mexer à vontade,
// e colocamos todo o visual (cor, foto, moldura, hover) no
// elemento "de dentro", que é só nosso.
//
// "pontasIndices" é opcional: uma lista de quais pontas (0 a 7)
// devem ficar acesas em dourado. O pin "representante" de um
// grupo recebe as primeiras N (uma por local escondido ali); um
// pin dentro do leque recebe só a ponta correspondente à
// posição dele (ver criarGrupoEmLeque).
function criarElementoPin(local, pontasIndices) {
  const embrulho = document.createElement('div');

  const elemento = document.createElement('div');
  elemento.className = 'pin-marcador';

  const classeCategoria = paraClasseCss(local.categoria);

  // Só adiciona a classe extra se a categoria não for "padrao"
  if (classeCategoria !== 'padrao') {
    elemento.classList.add(`pin-marcador--${classeCategoria}`);
  }

  // Define a camada (z-index) no embrulho — é ele que o
  // MapLibre realmente posiciona no mapa, então o z-index tem
  // que ficar nele, não no elemento visual de dentro.
  embrulho.style.zIndex = CAMADA_POR_CATEGORIA[classeCategoria] ?? 2;

  // A primeira foto da lista é sempre a "capa" — é ela que vira
  // o fundo do pin (uma "fotinho" redonda) em vez da bolinha
  // colorida lisa.
  if (temImagens(local)) {
    elemento.classList.add('pin-marcador--com-imagem');
    elemento.style.backgroundImage = `url('${local.imagens[0]}')`;
  }

  if (pontasIndices && pontasIndices.length > 0) {
    elemento.style.setProperty('--pontas-acesas', criarPontasIluminadas(pontasIndices));
  }

  embrulho.appendChild(elemento);
  return embrulho;
}

// Monta o HTML de dentro do pop-up, usando as classes que já
// existem no style.css (.popup-categoria, .popup-titulo, etc).
function criarHtmlPopup(local) {
  const classeCategoria = paraClasseCss(local.categoria);
  let htmlDaImagem = '';

  if (temImagens(local)) {
    const temVarias = local.imagens.length > 1;
    // As setinhas só entram no HTML se tiver mais de uma foto.
    const setasHtml = temVarias
      ? `
        <button type="button" class="popup-imagem-seta popup-imagem-seta--anterior" aria-label="Foto anterior">‹</button>
        <button type="button" class="popup-imagem-seta popup-imagem-seta--proxima" aria-label="Próxima foto">›</button>
      `
      : '';

    htmlDaImagem = `
      <div class="popup-imagem-container">
        <img class="popup-imagem" src="${local.imagens[0]}" alt="${local.titulo}">
        ${setasHtml}
      </div>
    `;
  }

  return `
    ${htmlDaImagem}
    <span class="popup-categoria popup-categoria--${classeCategoria}">${local.categoria}</span>
    <h3 class="popup-titulo">${local.titulo}</h3>
    <p class="popup-descricao">${local.descricao}</p>
  `;
}


// ------------------------------------------
// 6. INÍCIO — carrega os dados e só então monta tudo
// ------------------------------------------

// Preenchido depois que o carregarLocais() terminar. Fica fora
// da função pra outras partes do código (filtros, barra
// lateral) conseguirem enxergar essa lista também.
let locais = [];

carregarLocais()
  .then((dados) => {
    locais = dados;
    criarPinsEPopups();
    montarFiltros();
    montarBarraLateral();
  })
  .catch((erro) => {
    console.error('Erro ao carregar os dados dos locais:', erro);
    document.getElementById('carregando').innerHTML =
      '<p>Não foi possível carregar os dados do mapa (locais/NPCs/facções). Verifique os arquivos na pasta "dados/".</p>';
  });


// ------------------------------------------
// 7. CRIAÇÃO DOS PINS, POP-UPS E DO LEQUE
// ------------------------------------------

// Guarda cada marcador junto com sua categoria, pra depois os
// botões de filtro poderem mostrar/esconder só quem precisa.
const marcadores = [];

// Guarda, pra cada ÍNDICE do array "locais", uma função
// "abrirNoMapa()" — usada pelo botão "Ver no mapa" da barra
// lateral. Pra um local sozinho, ela só abre o popup dele. Pra
// um local que faz parte de um grupo, ela primeiro abre o
// leque, e só depois abre o popup daquele item específico.
const acaoVerNoMapaPorIndice = new Map();

// ================================================
// RAIO DE AGRUPAMENTO DO LEQUE — É AQUI QUE VOCÊ MEXE
// ================================================
// Dois pins entram no MESMO leque se a distância entre eles NA
// TELA (em pixels, não em metros) for menor ou igual a esse
// número. Por ser medido em pixels da tela, o agrupamento
// acompanha o zoom sozinho: com o mapa afastado, pins que estão
// longe um do outro no mundo real podem aparecer pertinho na
// tela e se juntam; dando zoom, os mesmos pins se afastam na
// tela e o leque se desfaz, virando pins separados.
// Aumente esse número pra agrupar mais generosamente, diminua
// pra agrupar só quem está bem colado.
const RAIO_AGRUPAMENTO_PIXELS = 20;

// Distância, em pixels da tela, entre dois pontos [longitude,
// latitude] — projeta os dois pra tela (map.project) e mede a
// distância entre eles como retângulo (Pitágoras).
function distanciaEmPixelsNaTela(coordenadasA, coordenadasB) {
  const pontoA = map.project(coordenadasA);
  const pontoB = map.project(coordenadasB);
  return Math.hypot(pontoA.x - pontoB.x, pontoA.y - pontoB.y);
}

// Agrupa os ÍNDICES dos locais que estão a RAIO_AGRUPAMENTO_PIXELS
// pixels (ou menos) de distância um do outro NA TELA, no zoom
// atual — usa "Union-Find" (uma estrutura clássica pra ir
// "fundindo" grupos conforme acha pares próximos): cada local
// começa no seu próprio grupinho, e sempre que dois estão perto,
// fundimos os grupos dos dois. No final, quem ficou no mesmo
// grupo (mesmo que só ficaram perto um do outro indiretamente,
// através de um terceiro no meio) forma um leque só.
function agruparIndicesPorProximidade(lista) {
  const indicesComCoordenada = [];
  lista.forEach((local, indice) => {
    if (local.coordenadas) {
      indicesComCoordenada.push(indice);
    }
  });

  const pai = new Map(indicesComCoordenada.map((indice) => [indice, indice]));

  function encontrarRaiz(indice) {
    while (pai.get(indice) !== indice) {
      pai.set(indice, pai.get(pai.get(indice))); // compressão de caminho
      indice = pai.get(indice);
    }
    return indice;
  }

  function unirGrupos(indiceA, indiceB) {
    const raizA = encontrarRaiz(indiceA);
    const raizB = encontrarRaiz(indiceB);
    if (raizA !== raizB) {
      pai.set(raizA, raizB);
    }
  }

  for (let i = 0; i < indicesComCoordenada.length; i++) {
    for (let j = i + 1; j < indicesComCoordenada.length; j++) {
      const indiceA = indicesComCoordenada[i];
      const indiceB = indicesComCoordenada[j];
      const distancia = distanciaEmPixelsNaTela(
        lista[indiceA].coordenadas,
        lista[indiceB].coordenadas
      );
      if (distancia <= RAIO_AGRUPAMENTO_PIXELS) {
        unirGrupos(indiceA, indiceB);
      }
    }
  }

  const grupos = {};
  indicesComCoordenada.forEach((indice) => {
    const raiz = encontrarRaiz(indice);
    if (!grupos[raiz]) {
      grupos[raiz] = [];
    }
    grupos[raiz].push(indice);
  });

  return Object.values(grupos);
}

// O leque tem sempre NUMERO_DE_FATIAS "fatias" fixas (tipo um
// relógio dividido em partes iguais) — não importa se o grupo
// tem 2, 3 ou 8 locais, as posições em si nunca mudam de lugar.
// Como a moldura de pedra tem exatamente 8 pontas, 8 fatias
// também significa que cada pin do leque acende uma ponta
// diferente, sem repetir nenhuma.
const NUMERO_DE_FATIAS = 8;
const RAIO_LEQUE = 60;
const POSICOES_LEQUE_FIXAS = Array.from({ length: NUMERO_DE_FATIAS }, (_, i) => {
  const angulo = (i / NUMERO_DE_FATIAS) * Math.PI * 2 - Math.PI / 2; // começa em cima (12h)
  return [
    Math.round(Math.cos(angulo) * RAIO_LEQUE),
    Math.round(Math.sin(angulo) * RAIO_LEQUE),
  ];
});

// Se algum leque estiver aberto no momento, guarda a função que
// fecha ELE especificamente — usada tanto pra fechar ao abrir
// outro leque, quanto ao clicar em espaço vazio do mapa.
let fecharLequeAbertoAtual = null;

// Camadas (z-index) usadas SÓ enquanto um leque está aberto —
// diferente da camada normal por categoria (1 a 3), porque
// precisamos garantir a ordem círculo de fundo < pin original <
// pins do leque, não importa a categoria de cada um.
const CAMADA_LEQUE_FUNDO = 1;
const CAMADA_LEQUE_PIN_ORIGINAL_ABERTO = 5;
const CAMADA_LEQUE_PIN_ABERTO = 10; // soma com a categoria (+1,+2,+3) na hora de usar

// Gera o círculo de fundo já "fatiado" em 6 pedaços iguais —
// as linhas ficam bem no meio do caminho entre duas posições
// do leque (POSICOES_LEQUE_FIXAS), então cada fatia acaba
// "abrigando" exatamente o pin que vai naquela direção.
// O tamanho acompanha o RAIO_LEQUE automaticamente, com uma
// margem extra pra caber o pin inteiro dentro da fatia.
function criarSvgFundoDoLeque() {
  const tamanho = RAIO_LEQUE * 2 + 70;
  const centro = tamanho / 2;
  const raio = centro - 2;

  let linhas = '';
  for (let i = 0; i < NUMERO_DE_FATIAS; i++) {
    // "+0.5" desloca meia fatia em relação às posições dos
    // pins — é isso que faz a linha cair na DIVISA entre duas
    // fatias, em vez de em cima de um pin.
    const angulo = ((i + 0.5) / NUMERO_DE_FATIAS) * Math.PI * 2 - Math.PI / 2;
    const x = (centro + Math.cos(angulo) * raio).toFixed(1);
    const y = (centro + Math.sin(angulo) * raio).toFixed(1);
    linhas += `<line x1='${centro}' y1='${centro}' x2='${x}' y2='${y}' stroke='%23000000' stroke-opacity='0.3' stroke-width='1.5'/>`;
  }

  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${tamanho} ${tamanho}'>` +
    `<circle cx='${centro}' cy='${centro}' r='${raio}' fill='%23808080' fill-opacity='0.4'/>` +
    linhas +
    `</svg>`;

  return {
    tamanho,
    url: `url("data:image/svg+xml,${svg.replace(/</g, '%3C').replace(/>/g, '%3E')}")`,
  };
}

// O círculo cinza (já fatiado em 6) que aparece atrás dos pins
// do leque (e na frente do pin original) enquanto ele estiver
// aberto — só pra dar uma pista visual de "esses pins pertencem
// a esse grupo", sem ser clicável (pointer-events: none — assim
// um clique nele "passa direto" pro mapa, fechando o leque como
// esperado, em vez de ficar preso ali sem fazer nada).
function criarMarcadorDeFundoDoLeque(coordenadas) {
  const elemento = document.createElement('div');
  elemento.className = 'leque-fundo';
  elemento.style.zIndex = CAMADA_LEQUE_FUNDO;

  const { tamanho, url } = criarSvgFundoDoLeque();
  elemento.style.width = `${tamanho}px`;
  elemento.style.height = `${tamanho}px`;
  elemento.style.backgroundImage = url;

  return new maplibregl.Marker({ element: elemento }).setLngLat(coordenadas);
}

// Cria o marcador + popup de UM local (com todo o carrossel de
// fotos já conectado). Não adiciona no mapa sozinho — quem
// chama decide a hora certa (locais sozinhos entram na hora;
// locais dentro de um grupo só entram quando o leque abre).
//
// "pontaAcesaIndice" é opcional: quando esse marcador é um dos
// pins de dentro de um leque, é a posição dele ali (0 = 1º,
// 1 = 2º, etc.) — usada pra acender a ponta correspondente.
//
// "coordenadasAncora" é opcional (padrão: a própria coordenada do
// local) — é o ponto de verdade no mapa em que o pin fica
// "pregado"; o deslocamentoPin (em pixels) desloca ele a partir
// dali. Pra um pin sozinho, isso é a coordenada dele mesmo. Pra um
// pin DENTRO de um leque, precisa ser a coordenada do representante
// do grupo — senão cada pin do leque fica ancorado na sua própria
// coordenada real (que pode estar um pouco longe da dos outros,
// já que agora agrupamos por proximidade na tela, não por
// coordenada idêntica) e o leque some de ficar bonitinho, centrado.
function criarMarcadorDoLocal(local, indice, deslocamentoPin, pontaAcesaIndice, coordenadasAncora) {
  const ancora = coordenadasAncora || local.coordenadas;
  const pontasIndices = pontaAcesaIndice !== undefined ? [pontaAcesaIndice] : undefined;
  const elementoPin = criarElementoPin(local, pontasIndices);
  const deslocamentoPopup = [deslocamentoPin[0], deslocamentoPin[1] - 25];

  const popup = new maplibregl.Popup({ offset: deslocamentoPopup })
    .setHTML(criarHtmlPopup(local));

  const marker = new maplibregl.Marker({ element: elementoPin, offset: deslocamentoPin })
    .setLngLat(ancora)
    .setPopup(popup);

  marcadores.push({ marker });

  if (temImagens(local)) {
    // "indiceImagemAtual" guarda qual foto está sendo exibida
    // DENTRO DESSE POPUP especificamente — cada popup tem a sua
    // própria "memória" de qual foto está mostrando.
    let indiceImagemAtual = 0;

    popup.on('open', () => {
      indiceImagemAtual = 0; // sempre reabre mostrando a capa
      const elementoPopup = popup.getElement();
      const imgDoPopup = elementoPopup.querySelector('.popup-imagem');
      if (!imgDoPopup) return;

      // Por que isso é necessário: a foto carrega de forma
      // assíncrona — o MapLibre já decide ONDE colocar o popup
      // na tela ANTES da foto terminar de carregar (baseado no
      // tamanho do popup sem a foto). Quando a foto termina de
      // carregar e o popup cresce, o MapLibre não recalcula a
      // posição sozinho, e o popup pode acabar cortado pra fora
      // da tela. Isso força um recálculo assim que a foto
      // termina de carregar.
      if (!imgDoPopup.complete) {
        imgDoPopup.addEventListener(
          'load',
          () => popup.setLngLat(ancora),
          { once: true }
        );
      }

      // Clicar na foto abre ela ampliada no lightbox, a partir
      // da foto que está sendo exibida no momento.
      imgDoPopup.addEventListener('click', () => {
        abrirLightbox(local.imagens, indiceImagemAtual, local.titulo);
      });

      // Setinhas de navegação (só existem no HTML se tiver mais
      // de uma foto — ver criarHtmlPopup).
      const setaAnterior = elementoPopup.querySelector('.popup-imagem-seta--anterior');
      const setaProxima = elementoPopup.querySelector('.popup-imagem-seta--proxima');

      function trocarFoto(novoIndice) {
        indiceImagemAtual = (novoIndice + local.imagens.length) % local.imagens.length;
        imgDoPopup.src = local.imagens[indiceImagemAtual];
      }

      if (setaAnterior) {
        setaAnterior.addEventListener('click', (evento) => {
          evento.stopPropagation();
          trocarFoto(indiceImagemAtual - 1);
        });
      }
      if (setaProxima) {
        setaProxima.addEventListener('click', (evento) => {
          evento.stopPropagation();
          trocarFoto(indiceImagemAtual + 1);
        });
      }

      // Registra esse popup como o "atual" pro teclado — só faz
      // diferença se tiver mais de uma foto (senão não tem seta
      // nenhuma pra função mexer mesmo).
      if (local.imagens.length > 1) {
        const meuControlador = {
          anterior: () => trocarFoto(indiceImagemAtual - 1),
          proxima: () => trocarFoto(indiceImagemAtual + 1),
        };
        controladorFotoPopupAtual = meuControlador;

        popup.once('close', () => {
          if (controladorFotoPopupAtual === meuControlador) {
            controladorFotoPopupAtual = null;
          }
        });
      }
    });
  }

  marcadorPorIndiceInterno.set(indice, marker);
  return marker;
}

// Mapa interno (índice → marker de verdade), usado só aqui
// dentro pra montar o leque — diferente do "acaoVerNoMapaPorIndice"
// que a barra lateral usa (esse é mais simples de usar de fora).
const marcadorPorIndiceInterno = new Map();

// Monta o pin "representante" (o que fica visível quando o
// grupo está fechado) e as funções de abrir/fechar o leque.
function criarGrupoEmLeque(indicesDoGrupo) {
  // O representante é sempre quem tiver a camada mais alta
  // (Local > Facção > NPC) DENTRE OS QUE ESTÃO VISÍVEIS pelos
  // filtros — indicesDoGrupo já chega aqui filtrado (ver
  // criarPinsEPopups), então isso já reflete só quem está
  // ativo no momento. Em empate, prevalece a ordem em que
  // apareceu nos arquivos JSON.
  const indiceRepresentante = indicesDoGrupo.reduce((melhor, atual) => {
    const camadaAtual = CAMADA_POR_CATEGORIA[paraClasseCss(locais[atual].categoria)] ?? 2;
    const camadaMelhor = CAMADA_POR_CATEGORIA[paraClasseCss(locais[melhor].categoria)] ?? 2;
    return camadaAtual > camadaMelhor ? atual : melhor;
  }, indicesDoGrupo[0]);

  const localRepresentante = locais[indiceRepresentante];

  // Pin-resumo: mostra as pontinhas acesas (uma por local
  // visível no grupo), mas não abre popup próprio — clicar nele
  // abre/fecha o leque.
  const elementoRepresentante = criarElementoPin(
    localRepresentante,
    Array.from({ length: indicesDoGrupo.length }, (_, i) => i)
  );
  const marcadorRepresentante = new maplibregl.Marker({ element: elementoRepresentante })
    .setLngLat(localRepresentante.coordenadas);

  // Overlay branco (40% de opacidade), escondido por padrão —
  // só aparece enquanto o leque está aberto, indicando que esse
  // pin "deu lugar" ao leque à sua volta.
  const overlayLeque = document.createElement('span');
  overlayLeque.className = 'pin-overlay-leque';
  elementoRepresentante.firstChild.appendChild(overlayLeque);

  marcadores.push({ marker: marcadorRepresentante });

  // Cria (sem mostrar ainda) o marcador de cada membro VISÍVEL
  // do grupo, na fatia fixa do leque que vai ocupar — como
  // indicesDoGrupo já veio filtrado, as fatias (0 = Norte, 1 =
  // Nordeste, 2 = Leste... sentido horário) são preenchidas em
  // sequência, sem pular buraco de quem está filtrado.
  const marcadoresDoGrupo = indicesDoGrupo.map((indice, posicao) => {
    const local = locais[indice];
    const deslocamento = POSICOES_LEQUE_FIXAS[posicao % NUMERO_DE_FATIAS];
    return criarMarcadorDoLocal(local, indice, deslocamento, posicao, localRepresentante.coordenadas);
  });

  let aberto = false;
  const marcadorDeFundo = criarMarcadorDeFundoDoLeque(localRepresentante.coordenadas);

  function abrirLeque() {
    if (fecharLequeAbertoAtual && fecharLequeAbertoAtual !== fecharLeque) {
      fecharLequeAbertoAtual();
    }

    // O pin original CONTINUA visível (não usamos mais .remove()
    // nele) — sobe pra ficar acima do círculo de fundo (que
    // agora é a camada mais baixa de todas), mas continua
    // abaixo dos pins do leque.
    elementoRepresentante.style.zIndex = CAMADA_LEQUE_PIN_ORIGINAL_ABERTO;
    overlayLeque.style.display = 'block';

    marcadorDeFundo.addTo(map);

    marcadoresDoGrupo.forEach((marker, posicao) => {
      const local = locais[indicesDoGrupo[posicao]];
      const camadaCategoria = CAMADA_POR_CATEGORIA[paraClasseCss(local.categoria)] ?? 2;
      // Camada bem mais alta que a normal, garantindo que os
      // pins do leque sempre fiquem por cima do círculo de
      // fundo — mesmo um NPC, que normalmente ficaria atrás
      // de tudo (mantém, entre eles, a mesma ordem de sempre).
      marker.getElement().style.zIndex = CAMADA_LEQUE_PIN_ABERTO + camadaCategoria;
      marker.addTo(map);
    });

    aberto = true;
    fecharLequeAbertoAtual = fecharLeque;
  }

  function fecharLeque() {
    marcadoresDoGrupo.forEach((marker) => {
      const popupDoMarcador = marker.getPopup();
      if (popupDoMarcador && popupDoMarcador.isOpen()) {
        popupDoMarcador.remove();
      }
      marker.remove();
    });

    marcadorDeFundo.remove();

    // Devolve o pin original pra camada normal dele (a mesma
    // usada quando o leque está fechado).
    const camadaOriginal = CAMADA_POR_CATEGORIA[paraClasseCss(localRepresentante.categoria)] ?? 2;
    elementoRepresentante.style.zIndex = camadaOriginal;
    overlayLeque.style.display = 'none';

    aberto = false;
    if (fecharLequeAbertoAtual === fecharLeque) {
      fecharLequeAbertoAtual = null;
    }
  }

  elementoRepresentante.firstChild.addEventListener('click', (evento) => {
    evento.stopPropagation();
    if (aberto) {
      fecharLeque();
    } else {
      abrirLeque();
    }
  });

  marcadorRepresentante.addTo(map);

  // "Ver no mapa" de qualquer item do grupo (inclusive o
  // representante): abre o leque primeiro (se ainda não
  // estiver aberto) e só então abre o popup daquele item.
  indicesDoGrupo.forEach((indice) => {
    acaoVerNoMapaPorIndice.set(indice, () => {
      if (!aberto) {
        abrirLeque();
      }
      const marker = marcadorPorIndiceInterno.get(indice);
      if (marker) {
        marker.togglePopup();
      }
      return localRepresentante.coordenadas;
    });
  });
}

// Remove TUDO que está no mapa hoje (pins soltos, representantes
// de leque, pins de dentro de leques abertos, fundo do leque) e
// limpa as listas/mapas que guardam essas referências — deixando
// tudo pronto pra criarPinsEPopups() montar de novo do zero.
// Necessário porque, a cada mudança de zoom, o agrupamento pode
// mudar (ver RAIO_AGRUPAMENTO_PIXELS lá em cima), e não dá pra só
// "ajustar" os pins existentes — é mais simples e mais seguro
// desmontar tudo e remontar com o agrupamento novo.
function limparPinsEPopups() {
  if (fecharLequeAbertoAtual) {
    fecharLequeAbertoAtual();
  }

  marcadores.forEach(({ marker }) => {
    const popupDoMarcador = marker.getPopup && marker.getPopup();
    if (popupDoMarcador && popupDoMarcador.isOpen()) {
      popupDoMarcador.remove();
    }
    marker.remove();
  });

  marcadores.length = 0;
  acaoVerNoMapaPorIndice.clear();
  marcadorPorIndiceInterno.clear();
}

function criarPinsEPopups() {
  limparPinsEPopups();

  const categoriasAtivas = obterCategoriasAtivas();
  const grupos = agruparIndicesPorProximidade(locais);

  grupos.forEach((grupo) => {
    // Só os índices do grupo cuja categoria está ativa nos
    // filtros agora — é a partir DESSA lista (não do grupo
    // inteiro) que decidimos quem é o representante, em que
    // fatia cada um entra, e quantas/quais pontas acender. Um
    // membro filtrado simplesmente não existe pra essas contas,
    // então não sobra buraco nem fatia pulada.
    const indicesVisiveis = grupo.filter((indice) =>
      categoriasAtivas.has(paraClasseCss(locais[indice].categoria))
    );

    if (indicesVisiveis.length === 0) {
      return; // grupo inteiro filtrado — nada a mostrar aqui
    }

    if (indicesVisiveis.length === 1) {
      const indice = indicesVisiveis[0];
      const local = locais[indice];
      const marker = criarMarcadorDoLocal(local, indice, [0, 0]);
      marker.addTo(map);
      acaoVerNoMapaPorIndice.set(indice, () => {
        marker.togglePopup();
        return local.coordenadas;
      });
      return;
    }

    criarGrupoEmLeque(indicesVisiveis);
  });
}

// Clicar em qualquer lugar "vazio" do mapa fecha o leque que
// estiver aberto. Só que o clique num pin também "borbulha" até
// aqui (é assim que o MapLibre funciona) — por isso conferimos se
// o clique caiu em cima de algum pin antes de fechar; se caiu,
// ignoramos (o próprio pin já cuida do que precisa acontecer,
// tipo abrir seu popup).
// Registrado só UMA vez (fora de criarPinsEPopups) porque essa
// função agora pode ser chamada várias vezes — se o listener
// estivesse lá dentro, ganharíamos um novo a cada zoom, todos
// fazendo a mesma coisa.
map.on('click', (evento) => {
  const clicouEmUmPin = evento.originalEvent.target.closest('.maplibregl-marker');
  if (clicouEmUmPin) {
    return;
  }
  if (fecharLequeAbertoAtual) {
    fecharLequeAbertoAtual();
  }
});

// Refaz os pins sempre que o usuário termina de dar zoom — é
// nesse momento que o agrupamento por proximidade (que depende do
// zoom) pode ter mudado. "zoomend" dispara uma vez só, quando o
// gesto de zoom termina (não uma porção de vezes durante o
// gesto), então é leve o suficiente pra recalcular tudo.
map.on('zoomend', () => {
  if (locais.length === 0) {
    return; // dados ainda não carregaram — nada pra (re)montar
  }
  criarPinsEPopups();
});


// ------------------------------------------
// 8. FILTROS POR CATEGORIA
// ------------------------------------------

// Só os botões de #filtros (canto do mapa) — os botões de
// filtro DENTRO da barra lateral (#filtros-lista) têm outro
// papel (filtram a lista, não os pins do mapa) e são tratados
// separadamente lá na seção 9.
const botoesFiltro = document.querySelectorAll('#filtros .filtro-botao');

// Quais categorias estão "ativas" agora, segundo os botões de
// #filtros — usada por criarPinsEPopups pra decidir o que
// existe (pin sozinho, representante de leque, fatia de cada
// membro) antes mesmo de criar qualquer coisa.
function obterCategoriasAtivas() {
  return new Set(
    Array.from(botoesFiltro)
      .filter((botao) => botao.classList.contains('ativo'))
      .map((botao) => botao.dataset.categoria)
  );
}

function montarFiltros() {
  // Preenche o "(N)" de cada botão com quantos locais existem
  // naquela categoria (conta TODOS, com ou sem pin no mapa).
  // Roda em QUALQUER botão de filtro com esse data-categoria,
  // no mapa ou na barra lateral, já que o número é o mesmo
  // nos dois lugares.
  ['local', 'npc', 'faccao'].forEach((categoria) => {
    const total = locais.filter((local) => paraClasseCss(local.categoria) === categoria).length;
    document.querySelectorAll(`.filtro-botao[data-categoria="${categoria}"] .filtro-contagem`)
      .forEach((contagem) => {
        contagem.textContent = `(${total})`;
      });
  });
}

// Ao ligar/desligar uma categoria, refazemos TODOS os pins do
// zero (em vez de só esconder/mostrar os que já existiam) —
// assim o representante de cada leque, a fatia de cada membro e
// as pontas acesas são recalculados já considerando só quem
// ficou visível (ver criarPinsEPopups). Como efeito colateral,
// isso também fecha qualquer leque/popup que estivesse aberto
// no momento — igual já acontecia ao dar zoom.
botoesFiltro.forEach((botao) => {
  botao.addEventListener('click', () => {
    botao.classList.toggle('ativo');
    criarPinsEPopups();
  });
});


// ------------------------------------------
// 9. BARRA LATERAL (lista de tudo já descoberto)
// ------------------------------------------

const barraLateral = document.getElementById('barra-lateral');
const barraLateralFundo = document.getElementById('barra-lateral-fundo');
const listaConteudo = document.getElementById('lista-conteudo');
const botaoAbrirLista = document.getElementById('botao-lista');
const botaoFecharLista = document.getElementById('fechar-lista');
const inputBuscaLista = document.getElementById('busca-lista');
const botoesFiltroLista = document.querySelectorAll('.filtro-lista-botao');

function abrirBarraLateral() {
  barraLateral.classList.add('aberta');
  barraLateralFundo.classList.add('ativo');
}

function fecharBarraLateral() {
  barraLateral.classList.remove('aberta');
  barraLateralFundo.classList.remove('ativo');

  // Reinicia o estado da sanfona: da próxima vez que a barra
  // abrir, todos os itens começam fechados de novo.
  listaConteudo.querySelectorAll('.lista-item.aberto').forEach((item) => {
    item.classList.remove('aberto');
  });

  // Reinicia busca e filtros da lista também: da próxima vez
  // que a barra abrir, começa mostrando tudo de novo.
  inputBuscaLista.value = '';
  botoesFiltroLista.forEach((botao) => botao.classList.add('ativo'));
  aplicarFiltrosDaLista();
}

botaoAbrirLista.addEventListener('click', abrirBarraLateral);
botaoFecharLista.addEventListener('click', fecharBarraLateral);
// Clicar no fundo escurecido (fora da barra) também fecha.
barraLateralFundo.addEventListener('click', fecharBarraLateral);

// Mostra/esconde cada item (e cada seção inteira) da barra
// lateral de acordo com: (1) quais botões de filtro estão
// "ativos" e (2) o texto digitado na busca. Um item só fica
// visível se PASSAR NOS DOIS ao mesmo tempo — categoria ligada
// E (busca vazia OU título/descrição contém o termo digitado).
// Se depois disso uma seção inteira não sobrar nenhum item
// visível, a seção some junto (título incluso), pra não deixar
// um cabeçalho "Locais" sozinho sem nada embaixo.
function aplicarFiltrosDaLista() {
  const termo = normalizarTexto(inputBuscaLista.value.trim());
  const categoriasAtivas = new Set(
    Array.from(botoesFiltroLista)
      .filter((botao) => botao.classList.contains('ativo'))
      .map((botao) => botao.dataset.categoria)
  );

  listaConteudo.querySelectorAll('.lista-secao').forEach((secao) => {
    const categoriaLigada = categoriasAtivas.has(secao.dataset.categoria);
    let algumItemVisivel = false;

    secao.querySelectorAll('.lista-item').forEach((item) => {
      const combinaComBusca = !termo || item.dataset.busca.includes(termo);
      const visivel = categoriaLigada && combinaComBusca;
      item.style.display = visivel ? '' : 'none';
      if (visivel) {
        algumItemVisivel = true;
      }
    });

    secao.style.display = algumItemVisivel ? '' : 'none';
  });
}

inputBuscaLista.addEventListener('input', aplicarFiltrosDaLista);

botoesFiltroLista.forEach((botao) => {
  botao.addEventListener('click', () => {
    botao.classList.toggle('ativo');
    aplicarFiltrosDaLista();
  });
});

// Nome de exibição de cada categoria (plural, mais bonito) —
// se você criar uma categoria nova, adiciona ela aqui também.
const NOMES_CATEGORIA = {
  local: 'Locais',
  npc: 'NPCs',
  faccao: 'Facções',
};

// Monta o HTML de UM item da lista. A foto exibida aqui é
// sempre a capa (imagens[0]) — pra ver as outras fotos, é só
// clicar nela, que abre todas no lightbox com setinhas.
function criarItemLista(local, indice) {
  const imagemHtml = temImagens(local)
    ? `<img class="lista-item-imagem" data-indice="${indice}" src="${local.imagens[0]}" alt="${local.titulo}">`
    : '';

  // O botão "Ver no mapa" só aparece se esse local tiver
  // coordenadas — sem posição fixa, não tem pra onde levar.
  const botaoMapaHtml = local.coordenadas
    ? `<button type="button" class="lista-item-botao-mapa" data-indice="${indice}">Ver no mapa</button>`
    : '';

  // data-categoria: pros botões de filtro DENTRO da barra
  // lateral saberem qual item esconder/mostrar.
  // data-busca: título + descrição já normalizados (minúsculo,
  // sem acento), pra comparar direto com o que a pessoa digita
  // na busca sem precisar reprocessar a cada tecla.
  const categoria = paraClasseCss(local.categoria);
  const textoBusca = normalizarTexto(`${local.titulo} ${local.descricao}`);

  return `
    <div class="lista-item" data-categoria="${categoria}" data-busca="${textoBusca}">
      <button type="button" class="lista-item-cabecalho">
        <span class="lista-item-titulo">${local.titulo}</span>
        <span class="lista-item-seta">▾</span>
      </button>
      <div class="lista-item-corpo">
        ${imagemHtml}
        <p class="lista-item-descricao">${local.descricao}</p>
        ${botaoMapaHtml}
      </div>
    </div>
  `;
}

// Agrupa os locais por categoria e monta a lista inteira.
function montarBarraLateral() {
  const grupos = {};

  locais.forEach((local, indice) => {
    const categoria = paraClasseCss(local.categoria);
    if (!grupos[categoria]) {
      grupos[categoria] = [];
    }
    grupos[categoria].push(criarItemLista(local, indice));
  });

  listaConteudo.innerHTML = Object.keys(grupos)
    .map((categoria) => {
      const nome = NOMES_CATEGORIA[categoria] || categoria;
      // Cada categoria vira uma .lista-secao própria (título +
      // itens juntos), com data-categoria — assim os filtros da
      // barra lateral conseguem esconder o grupo inteiro de uma
      // vez (título incluso) quando a busca não acha nada nele,
      // ou quando o botão daquela categoria está desligado.
      return `
        <div class="lista-secao" data-categoria="${categoria}">
          <h3 class="lista-secao-titulo lista-secao-titulo--${categoria}">${nome}</h3>
          ${grupos[categoria].join('')}
        </div>
      `;
    })
    .join('');

  // Clicar no título de um item abre/fecha a descrição dele
  // (efeito sanfona — só esconde/mostra um <div> via CSS).
  listaConteudo.querySelectorAll('.lista-item-cabecalho').forEach((cabecalho) => {
    cabecalho.addEventListener('click', () => {
      cabecalho.parentElement.classList.toggle('aberto');
    });
  });

  // Clicar em "Ver no mapa": fecha a barra, centraliza o mapa
  // naquele local (abrindo o leque primeiro, se for o caso) e
  // abre o popup dele.
  listaConteudo.querySelectorAll('.lista-item-botao-mapa').forEach((botao) => {
    botao.addEventListener('click', (evento) => {
      evento.stopPropagation(); // não deixa também abrir/fechar a sanfona
      const indice = Number(botao.dataset.indice);
      const acao = acaoVerNoMapaPorIndice.get(indice);
      if (!acao) return;

      fecharBarraLateral();
      const coordenadas = acao();
      // "padding" reserva um espaço (em pixels) de cada lado da
      // tela que NÃO conta como área "central" — reservando
      // espaço em cima, o MapLibre centraliza o pin dentro do
      // espaço que sobra embaixo, deixando o topo livre pro
      // popup abrir sem cortar.
      map.flyTo({
        center: coordenadas,
        zoom: 15,
        padding: { top: 220, bottom: 0, left: 0, right: 0 },
      });
    });
  });

  // Clicar na foto de um item da lista abre TODAS as fotos
  // daquele local no lightbox (começando pela capa).
  listaConteudo.querySelectorAll('.lista-item-imagem').forEach((imagem) => {
    imagem.addEventListener('click', (evento) => {
      evento.stopPropagation();
      const indice = Number(imagem.dataset.indice);
      const local = locais[indice];
      abrirLightbox(local.imagens, 0, local.titulo);
    });
  });

  // A lista acabou de ser reconstruída do zero (innerHTML novo),
  // então reaplicamos a busca/filtros atuais nela — senão um
  // termo já digitado ou uma categoria desligada "esqueceria"
  // de valer pros itens recém-criados.
  aplicarFiltrosDaLista();
}

// ------------------------------------------
// 10. BARRA DE BAIRROS (topo, fixa)
// ------------------------------------------
// Carrega dados/bairros.json — uma LISTA de objetos com:
//   nome   (texto, aparece como opção no seletor)
//   info   (texto, aparece ao lado do seletor quando esse
//           bairro está selecionado)
//
// Pra adicionar/editar um bairro, mexa só no JSON — não precisa
// tocar neste arquivo.

const seletorBairro = document.getElementById('seletor-bairro');
const infoBairro = document.getElementById('info-bairro');

async function carregarBairros() {
  const resposta = await fetch('dados/bairros.json');
  if (!resposta.ok) {
    throw new Error(`Não consegui carregar "dados/bairros.json" (status ${resposta.status})`);
  }
  return resposta.json();
}

function montarBarraDeBairros(bairros) {
  bairros.forEach((bairro, indice) => {
    const opcao = document.createElement('option');
    opcao.value = String(indice);
    opcao.textContent = bairro.nome;
    seletorBairro.appendChild(opcao);
  });

  seletorBairro.addEventListener('change', () => {
    if (seletorBairro.value === '') {
      infoBairro.textContent = '';
      return;
    }
    const bairro = bairros[Number(seletorBairro.value)];
    infoBairro.textContent = bairro ? bairro.info : '';
  });
}

carregarBairros()
  .then((bairros) => montarBarraDeBairros(bairros))
  .catch((erro) => {
    // Erro aqui não trava o resto do mapa (locais/NPCs/facções
    // continuam funcionando normalmente) — só avisa no console e
    // deixa o seletor vazio (só com a opção "Selecione...").
    console.error('Erro ao carregar os bairros:', erro);
  });

// Recolher/expandir: alterna uma classe no #app (que o CSS usa
// pra encolher a barra e "subir" o mapa/ui pro lugar dela) e
// mantém o botão acessível — texto (seta) e atributos ARIA
// sempre condizentes com o estado atual.
const appElemento = document.getElementById('app');
const botaoAlternarBarraBairros = document.getElementById('alternar-barra-bairros');

botaoAlternarBarraBairros.addEventListener('click', () => {
  const estaRecolhida = appElemento.classList.toggle('barra-bairros-recolhida');
  botaoAlternarBarraBairros.setAttribute('aria-expanded', String(!estaRecolhida));
  botaoAlternarBarraBairros.setAttribute(
    'aria-label',
    estaRecolhida ? 'Expandir barra de bairros' : 'Recolher barra de bairros'
  );
  botaoAlternarBarraBairros.textContent = estaRecolhida ? '▼' : '▲';
});
