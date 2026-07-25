/* ============================================
   RIO INVISÍVEL — script.js
   ============================================
   Este arquivo:
   1. Cria o mapa usando o estilo que você fez no MapTiler
   2. Carrega os dados dos locais/NPCs/facções dos arquivos JSON
   3. Adiciona os pins (marcadores) no mapa
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

lightboxAnterior.addEventListener('click', (evento) => {
  evento.stopPropagation(); // não deixa isso também fechar o lightbox
  lightboxIndiceAtual = (lightboxIndiceAtual - 1 + lightboxImagens.length) % lightboxImagens.length;
  atualizarImagemLightbox();
});

lightboxProxima.addEventListener('click', (evento) => {
  evento.stopPropagation();
  lightboxIndiceAtual = (lightboxIndiceAtual + 1) % lightboxImagens.length;
  atualizarImagemLightbox();
});

// Clicar em qualquer lugar do fundo escuro fecha o lightbox.
lightbox.addEventListener('click', fecharLightbox);

// Tecla ESC fecha o que estiver aberto: lightbox ou barra lateral.
document.addEventListener('keydown', (evento) => {
  if (evento.key === 'Escape') {
    fecharLightbox();
    fecharBarraLateral();
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

// Um local "tem imagens" se o campo existir e não estiver vazio.
function temImagens(local) {
  return Array.isArray(local.imagens) && local.imagens.length > 0;
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
function criarElementoPin(local) {
  const embrulho = document.createElement('div');

  const elemento = document.createElement('div');
  elemento.className = 'pin-marcador';

  const classeCategoria = paraClasseCss(local.categoria);

  // Só adiciona a classe extra se a categoria não for "padrao"
  if (classeCategoria !== 'padrao') {
    elemento.classList.add(`pin-marcador--${classeCategoria}`);
  }

  // A primeira foto da lista é sempre a "capa" — é ela que vira
  // o fundo do pin (uma "fotinho" redonda) em vez da bolinha
  // colorida lisa.
  if (temImagens(local)) {
    elemento.classList.add('pin-marcador--com-imagem');
    elemento.style.backgroundImage = `url('${local.imagens[0]}')`;
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
// 7. CRIAÇÃO DOS PINS E POP-UPS
// ------------------------------------------

// Guarda cada marcador junto com sua categoria, pra depois os
// botões de filtro poderem mostrar/esconder só quem precisa.
const marcadores = [];

// Guarda o marcador de cada local pelo ÍNDICE dele no array
// "locais" — é assim que o botão "Ver no mapa" da barra
// lateral encontra o pin certo pra centralizar e abrir.
const marcadorPorIndice = new Map();

function criarPinsEPopups() {
  locais.forEach((local, indice) => {
    // Sem coordenadas, não tem como virar pin — esse local só
    // aparece na barra lateral.
    if (!local.coordenadas) {
      return;
    }

    const elementoPin = criarElementoPin(local);
    const classeCategoria = paraClasseCss(local.categoria);

    const popup = new maplibregl.Popup({ offset: 25 })
      .setHTML(criarHtmlPopup(local));

    const marker = new maplibregl.Marker({ element: elementoPin })
      .setLngLat(local.coordenadas)
      .setPopup(popup)
      .addTo(map);

    marcadores.push({ marker, categoria: classeCategoria });
    marcadorPorIndice.set(indice, marker);

    if (temImagens(local)) {
      // "indiceImagemAtual" guarda qual foto está sendo exibida
      // DENTRO DESSE POPUP especificamente — cada popup tem a
      // sua própria "memória" de qual foto está mostrando.
      let indiceImagemAtual = 0;

      popup.on('open', () => {
        indiceImagemAtual = 0; // sempre reabre mostrando a capa
        const elementoPopup = popup.getElement();
        const imgDoPopup = elementoPopup.querySelector('.popup-imagem');
        if (!imgDoPopup) return;

        // Por que isso é necessário: a foto carrega de forma
        // assíncrona — o MapLibre já decide ONDE colocar o
        // popup na tela ANTES da foto terminar de carregar
        // (baseado no tamanho do popup sem a foto). Quando a
        // foto termina de carregar e o popup cresce, o MapLibre
        // não recalcula a posição sozinho, e o popup pode
        // acabar cortado pra fora da tela. Isso força um
        // recálculo assim que a foto termina de carregar.
        if (!imgDoPopup.complete) {
          imgDoPopup.addEventListener(
            'load',
            () => popup.setLngLat(local.coordenadas),
            { once: true }
          );
        }

        // Clicar na foto abre ela ampliada no lightbox, a
        // partir da foto que está sendo exibida no momento.
        imgDoPopup.addEventListener('click', () => {
          abrirLightbox(local.imagens, indiceImagemAtual, local.titulo);
        });

        // Setinhas de navegação (só existem no HTML se tiver
        // mais de uma foto — ver criarHtmlPopup).
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
      });
    }
  });
}


// ------------------------------------------
// 8. FILTROS POR CATEGORIA
// ------------------------------------------

const botoesFiltro = document.querySelectorAll('.filtro-botao');

function montarFiltros() {
  // Preenche o "(N)" de cada botão com quantos locais existem
  // naquela categoria (conta TODOS, com ou sem pin no mapa).
  botoesFiltro.forEach((botao) => {
    const categoria = botao.dataset.categoria;
    const total = locais.filter((local) => paraClasseCss(local.categoria) === categoria).length;
    botao.querySelector('.filtro-contagem').textContent = `(${total})`;
  });
}

botoesFiltro.forEach((botao) => {
  botao.addEventListener('click', () => {
    botao.classList.toggle('ativo');

    const categoria = botao.dataset.categoria;
    const visivel = botao.classList.contains('ativo');

    marcadores
      .filter((item) => item.categoria === categoria)
      .forEach((item) => {
        item.marker.getElement().style.display = visivel ? '' : 'none';

        // Se a categoria foi desligada e o popup dela estava
        // aberto, fecha ele também — senão fica um popup
        // "flutuando" sozinho sem o pin correspondente visível.
        if (!visivel) {
          const popupDoMarcador = item.marker.getPopup();
          if (popupDoMarcador && popupDoMarcador.isOpen()) {
            popupDoMarcador.remove();
          }
        }
      });
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
}

botaoAbrirLista.addEventListener('click', abrirBarraLateral);
botaoFecharLista.addEventListener('click', fecharBarraLateral);
// Clicar no fundo escurecido (fora da barra) também fecha.
barraLateralFundo.addEventListener('click', fecharBarraLateral);

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

  return `
    <div class="lista-item">
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
      return `<h3 class="lista-secao-titulo lista-secao-titulo--${categoria}">${nome}</h3>${grupos[categoria].join('')}`;
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
  // naquele local e abre o popup dele.
  listaConteudo.querySelectorAll('.lista-item-botao-mapa').forEach((botao) => {
    botao.addEventListener('click', (evento) => {
      evento.stopPropagation(); // não deixa também abrir/fechar a sanfona
      const indice = Number(botao.dataset.indice);
      const marker = marcadorPorIndice.get(indice);
      if (!marker) return;

      fecharBarraLateral();
      // "padding" reserva um espaço (em pixels) de cada lado da
      // tela que NÃO conta como área "central" — reservando
      // espaço em cima, o MapLibre centraliza o pin dentro do
      // espaço que sobra embaixo, deixando o topo livre pro
      // popup abrir sem cortar.
      map.flyTo({
        center: marker.getLngLat(),
        zoom: 15,
        padding: { top: 460, bottom: 0, left: 0, right: 0 },
      });
      marker.togglePopup();
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
}