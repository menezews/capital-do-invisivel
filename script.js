/* ============================================
   RIO INVISÍVEL — script.js
   ============================================
   Este arquivo:
   1. Cria o mapa usando o estilo que você fez no MapTiler
   2. Adiciona os pins (marcadores) no mapa
   3. Cria os pop-ups de cada pin, usando as classes do style.css

   Pra adicionar um novo local no mapa, edite o array "locais"
   lá embaixo (seção 3) — não precisa mexer no resto do código.
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
// 3. DADOS DOS LOCAIS (PINS)
// ------------------------------------------

// Cada objeto aqui é um local no mapa. Pra adicionar um novo,
// copie um bloco inteiro (do "{" até o "},") e edite os valores.
//
// categoria: controla a cor do pin E aparece no texto do
// pop-up. Hoje existem: 'Local', 'NPC', 'Faccao'.
//
// coordenadas: [longitude, latitude] — nessa ordem, invertida
// em relação ao que a gente costuma falar (“latitude e
// longitude”). É assim que o MapLibre espera.
//
// imagem: OPCIONAL. Caminho pro arquivo de imagem (recomendo
// colocar suas fotos numa pasta "assets/imagens/" e apontar
// pra lá). Se você não colocar essa linha num local, ele
// simplesmente usa a bolinha colorida de sempre, sem imagem.
const locais = [
  {
    coordenadas: [-43.17875, -22.90525],
    categoria: 'Local',
    titulo: 'Confeitaria Colombo',
    descricao: 'As comidas mais saborosas, e os encontros mais necessários. Um lugar de muitas magias.',
    imagem: 'assets/imagens/Colombo.png',
  },
  {
coordenadas: [-43.182194, -22.905472],
    categoria: 'Local',
    titulo: 'GRPL - Gabinete Real Português de Leitura OC - MHC - MHSE - ComB - MHCa ',
    descricao: 'O arquivo da cidade. Protegido e zelado pela Grã-Cruz Leo.',
    imagem: 'assets/imagens/Gabinete.png',
  },
];


// ------------------------------------------
// 4. LIGHTBOX (ampliar a foto do popup)
// ------------------------------------------

const lightbox = document.getElementById('lightbox');
const lightboxImagem = document.getElementById('lightbox-imagem');

function abrirLightbox(src, alt) {
  lightboxImagem.src = src;
  lightboxImagem.alt = alt;
  lightbox.classList.add('ativo');
}

function fecharLightbox() {
  lightbox.classList.remove('ativo');
}

// Clicar em qualquer lugar do fundo escuro fecha o lightbox.
lightbox.addEventListener('click', fecharLightbox);

// Tecla ESC também fecha, útil pra quem prefere teclado.
document.addEventListener('keydown', (evento) => {
  if (evento.key === 'Escape') fecharLightbox();
});


// ------------------------------------------
// 5. CRIAÇÃO DOS PINS E POP-UPS
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

  // Se esse local tem imagem, usa ela como fundo do pin
  // (uma "fotinho" redonda) em vez da bolinha colorida lisa.
  if (local.imagem) {
    elemento.classList.add('pin-marcador--com-imagem');
    elemento.style.backgroundImage = `url('${local.imagem}')`;
  }

  embrulho.appendChild(elemento);
  return embrulho;
}

// Monta o HTML de dentro do pop-up, usando as classes que já
// existem no style.css (.popup-categoria, .popup-titulo, etc).
function criarHtmlPopup(local) {
  // Só gera a tag <img> se esse local tiver uma imagem definida.
  const htmlDaImagem = local.imagem
    ? `<img class="popup-imagem" src="${local.imagem}" alt="${local.titulo}">`
    : '';

  const classeCategoria = paraClasseCss(local.categoria);

  return `
    ${htmlDaImagem}
    <span class="popup-categoria popup-categoria--${classeCategoria}">${local.categoria}</span>
    <h3 class="popup-titulo">${local.titulo}</h3>
    <p class="popup-descricao">${local.descricao}</p>
  `;
}

// Guarda cada marcador junto com sua categoria, pra depois os
// botões de filtro poderem mostrar/esconder só quem precisa.
const marcadores = [];

// Passa por cada local da lista e coloca ele no mapa.
locais.forEach((local) => {
  const elementoPin = criarElementoPin(local);
  const classeCategoria = paraClasseCss(local.categoria);

  const popup = new maplibregl.Popup({ offset: 25 })
    .setHTML(criarHtmlPopup(local));

  const marker = new maplibregl.Marker({ element: elementoPin })
    .setLngLat(local.coordenadas)
    .setPopup(popup)
    .addTo(map);

  marcadores.push({ marker, categoria: classeCategoria });

  // Por que isso é necessário: quando o popup tem foto, ela
  // carrega de forma assíncrona — ou seja, o MapLibre já decide
  // ONDE colocar o popup na tela ANTES da foto terminar de
  // carregar (baseado no tamanho do popup sem a foto). Quando a
  // foto termina de carregar e o popup cresce, o MapLibre não
  // recalcula a posição sozinho, e o popup pode acabar cortado
  // pra fora da tela. Esse trecho força um recálculo assim que
  // a foto termina de carregar, movendo o popup pra continuar
  // inteiro dentro da janela.
  if (local.imagem) {
    popup.on('open', () => {
      const imgDoPopup = popup.getElement().querySelector('.popup-imagem');
      if (imgDoPopup) {
        if (!imgDoPopup.complete) {
          imgDoPopup.addEventListener(
            'load',
            () => popup.setLngLat(local.coordenadas),
            { once: true }
          );
        }
        // Clicar na foto do popup abre ela ampliada no lightbox.
        imgDoPopup.addEventListener('click', () => {
          abrirLightbox(local.imagem, local.titulo);
        });
      }
    });
  }
});


// ------------------------------------------
// 6. FILTROS POR CATEGORIA
// ------------------------------------------

// Cada botão de filtro tem um atributo data-categoria (definido
// no index.html) que precisa bater com a categoria do local
// (já convertida pra minúsculo/sem acento pela paraClasseCss).
const botoesFiltro = document.querySelectorAll('.filtro-botao');

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