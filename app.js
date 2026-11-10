/* =========================================================
   PROJETO FAZENDA
   GOOGLE SHEETS + DASHBOARD

   Planilha:
   1IH9S__uyU11xFJYprjBrnsidPENbqzpfXx-cZ51QjhI

   O dashboard lê a aba publicada como CSV.
========================================================= */


const SHEET_ID =
    "1IH9S__uyU11xFJYprjBrnsidPENbqzpfXx-cZ51QjhI";


/*
   Se a aba principal da sua planilha for "Respostas ao formulário 1",
   deixe assim.

   Se sua aba tiver outro nome, altere somente esta variável.
*/

const SHEET_NAME =
    "Respostas ao formulário 1";


/*
   Atualização MANUAL.

   Os dados são carregados uma vez ao abrir a página e só são
   atualizados quando a pessoa clica em "Atualizar dados"
   (menu lateral). Não existe mais atualização automática.
*/


/* =========================================================
   URL DO GOOGLE SHEETS
========================================================= */

function getSheetURL() {

    return (
        "https://docs.google.com/spreadsheets/d/" +
        SHEET_ID +
        "/gviz/tq?tqx=out:csv&sheet=" +
        encodeURIComponent(SHEET_NAME) +
        "&_=" +
        Date.now()
    );

}


/* =========================================================
   ESTADO
========================================================= */

let allData = [];

let filteredData = [];

let headers = [];

let charts = {};

let currentFilterColumn = "";

let currentFilterValue = "";

let isLoading = false;


/*
   Modo de visualização de cada gráfico.

   Guardado por uma "chave" estável (nome da coluna,
   ou uma chave fixa como "overview_main"), e não pelo
   id do canvas, já que os ids são recriados a cada
   atualização dos dados.
*/

let chartViewModes = {};

const CHART_VIEW_LABELS = {
    bar: "Barras",
    pie: "Setores",
    points: "Pontos",
    line: "Linhas",
    ogive: "Ogiva"
};


/* =========================================================
   INICIALIZAÇÃO
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        setupNavigation();

        setupFilters();

        setupStatistics();

        setupViewToggles();

        setupRefreshButton();

        await loadData();

    }
);


/* =========================================================
   NAVEGAÇÃO
========================================================= */

function setupNavigation() {

    document
        .querySelectorAll(".nav-button")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const page =
                        button.dataset.page;


                    document
                        .querySelectorAll(".nav-button")
                        .forEach(btn =>
                            btn.classList.remove("active")
                        );


                    button.classList.add("active");


                    document
                        .querySelectorAll(".page")
                        .forEach(section =>
                            section.classList.remove("active")
                        );


                    document
                        .getElementById(page)
                        .classList.add("active");


                    renderCurrentPage();

                }
            );

        });

}


function renderCurrentPage() {

    const page =
        document.querySelector(
            ".page.active"
        );


    if (!page) {
        return;
    }


    switch(page.id) {

        case "overview":
            renderOverview();
            break;

        case "rebanho":
            renderRebanho();
            break;

        case "alimentacao":
            renderAlimentacao();
            break;

        case "saude":
            renderSaude();
            break;

        case "ambiente":
            renderAmbiente();
            break;

        case "estatistica":
            updateStatistics();
            break;

    }

}


/* =========================================================
   CARREGAMENTO
========================================================= */

function setupRefreshButton() {

    const button =
        document.getElementById(
            "refreshButton"
        );

    if (!button) {
        return;
    }

    button.addEventListener(
        "click",
        loadData
    );

}


function setRefreshButtonState(
    loading
) {

    const button =
        document.getElementById(
            "refreshButton"
        );

    if (!button) {
        return;
    }

    button.disabled = loading;

    button.classList.toggle(
        "is-loading",
        loading
    );

    const label =
        button.querySelector(
            ".refresh-label"
        );

    if (label) {
        label.textContent =
            loading
                ? "Atualizando..."
                : "Atualizar dados";
    }

}


function showLoadingScreen() {

    const loading =
        document.getElementById(
            "loadingScreen"
        );

    loading.classList.remove(
        "hidden"
    );

    loading.innerHTML = `

        <div class="loader"></div>

        <h2>Carregando dados...</h2>

        <p>
            Buscando respostas do Google Sheets.
        </p>

    `;

}


async function loadData() {

    // Evita cliques repetidos enquanto uma atualização está em andamento.
    if (isLoading) {
        return;
    }

    isLoading = true;

    setRefreshButtonState(true);

    // Só mostra a tela cheia de "carregando" na primeira carga;
    // nas atualizações manuais os gráficos continuam visíveis.
    if (!allData.length) {
        showLoadingScreen();
    }

    setConnection(
        "loading",
        "● Atualizando dados..."
    );


    try {

        const response =
            await fetch(
                getSheetURL(),
                {
                    cache: "no-store"
                }
            );


        if (!response.ok) {

            throw new Error(
                "Não foi possível acessar a planilha."
            );

        }


        const csv =
            await response.text();


        const parsed =
            parseCSV(csv);


        if (
            !parsed ||
            parsed.length < 2
        ) {

            throw new Error(
                "A planilha não possui respostas suficientes."
            );

        }


        /*
           Lê TODOS os cabeçalhos da planilha, mas descarta a
           coluna de e-mail (dado pessoal) antes de montar os
           dados. Os índices continuam sendo lidos de
           "allHeaders", então o mapeamento permanece correto.
        */

        const allHeaders =
            parsed[0].map(cleanHeader);


        allData =
            parsed
                .slice(1)
                .filter(row =>
                    row.some(
                        value =>
                            String(value).trim() !== ""
                    )
                )
                .map(row => {

                    const object = {};

                    allHeaders.forEach(
                        (header, index) => {

                            if (
                                isEmailColumn(header) ||
                                isIgnoredColumn(header)
                            ) {
                                return;
                            }

                            object[header] =
                                row[index] ??
                                "";

                        }
                    );

                    return object;

                });


        headers =
            allHeaders.filter(
                header =>
                    !isEmailColumn(header) &&
                    !isIgnoredColumn(header)
            );


        rebuildFilters();

        // Mantém o filtro escolhido (se ele ainda existir nos dados novos).
        filteredData =
            computeFilteredData();

        renderEverything();


        setConnection(
            "online",
            "● Dados carregados"
        );


        document.getElementById(
            "lastUpdate"
        ).textContent =
            new Date().toLocaleString(
                "pt-BR"
            );


    } catch(error) {

        console.error(error);


        setConnection(
            "offline",
            "● Erro ao carregar"
        );


        if (allData.length) {

            // Já existem dados na tela: mantém tudo visível e só avisa.
            setConnection(
                "offline",
                "● Falha ao atualizar — exibindo os dados anteriores"
            );

        } else {

            showError(
                error.message
            );

        }

    } finally {

        isLoading = false;

        setRefreshButtonState(false);

    }

}


/* =========================================================
   CSV PARSER
========================================================= */

function parseCSV(text) {

    const rows = [];

    let row = [];

    let cell = "";

    let insideQuotes = false;


    for (
        let i = 0;
        i < text.length;
        i++
    ) {

        const char =
            text[i];

        const next =
            text[i + 1];


        if (
            char === '"' &&
            insideQuotes &&
            next === '"'
        ) {

            cell += '"';

            i++;

            continue;

        }


        if (
            char === '"'
        ) {

            insideQuotes =
                !insideQuotes;

            continue;

        }


        if (
            char === "," &&
            !insideQuotes
        ) {

            row.push(cell);

            cell = "";

            continue;

        }


        if (
            (char === "\n" ||
             char === "\r") &&
            !insideQuotes
        ) {

            if (
                char === "\r" &&
                next === "\n"
            ) {

                i++;

            }


            row.push(cell);

            rows.push(row);

            row = [];

            cell = "";

            continue;

        }


        cell += char;

    }


    if (
        cell !== "" ||
        row.length
    ) {

        row.push(cell);

        rows.push(row);

    }


    return rows;

}


/* =========================================================
   LIMPEZA
========================================================= */

function cleanHeader(value) {

    return String(value ?? "")
        .replace(/\uFEFF/g, "")
        .replace(/\r/g, "")
        .replace(/\n/g, " ")
        .replace(/\s+/g, " ")
        .trim();

}


function cleanValue(value) {

    return String(value ?? "")
        .replace(/\r/g, "")
        .replace(/\n/g, " ")
        .trim();

}


/* =========================================================
   STATUS
========================================================= */

function setConnection(
    className,
    text
) {

    const element =
        document.getElementById(
            "connectionStatus"
        );


    element.className =
        "connection " +
        className;


    element.textContent =
        text;

}


/* =========================================================
   FILTROS
========================================================= */

function setupFilters() {

    const column =
        document.getElementById(
            "filterColumn"
        );


    const value =
        document.getElementById(
            "filterValue"
        );


    column.addEventListener(
        "change",
        () => {

            currentFilterColumn =
                column.value;


            currentFilterValue =
                "";


            populateFilterValues();

            updateFilterHint();

            applyFilters();

        }
    );


    value.addEventListener(
        "change",
        () => {

            currentFilterValue =
                value.value;

            applyFilters();

        }
    );


    document
        .getElementById(
            "clearFilters"
        )
        .addEventListener(
            "click",
            clearFilters
        );

}


function rebuildFilters() {

    const select =
        document.getElementById(
            "filterColumn"
        );


    const old =
        currentFilterColumn;


    select.innerHTML =
        '<option value="">Todos os dados</option>';


    headers.forEach(
        header => {

            if (
                !header ||
                isTimestamp(header)
            ) {

                return;

            }


            const option =
                document.createElement(
                    "option"
                );


            option.value =
                header;


            option.textContent =
                shortenHeader(header);

            option.title =
                header;


            select.appendChild(
                option
            );

        }
    );


    if (
        headers.includes(old)
    ) {

        select.value =
            old;

    }


    populateFilterValues();

    updateFilterHint();

}


/*
   O <select> da barra lateral é estreito e corta o texto da
   pergunta. Mostramos a pergunta completa logo abaixo dele.
*/

function updateFilterHint() {

    const hint =
        document.getElementById(
            "filterColumnHint"
        );

    if (!hint) {
        return;
    }

    hint.textContent =
        currentFilterColumn || "";

    hint.hidden =
        !currentFilterColumn;

}


function populateFilterValues() {

    const select =
        document.getElementById(
            "filterValue"
        );


    select.innerHTML =
        '<option value="">Todos</option>';


    if (
        !currentFilterColumn
    ) {

        return;

    }


    const values =
        uniqueValues(
            allData.map(
                row =>
                    row[currentFilterColumn]
            )
        );


    values.forEach(
        item => {

            const option =
                document.createElement(
                    "option"
                );


            option.value =
                item;


            option.textContent =
                item;


            select.appendChild(
                option
            );

        }
    );


    if (
        values.includes(
            currentFilterValue
        )
    ) {

        select.value =
            currentFilterValue;

    }

}


function computeFilteredData() {

    if (
        !currentFilterColumn ||
        !currentFilterValue ||
        !headers.includes(currentFilterColumn)
    ) {

        return [...allData];

    }

    return allData.filter(
        row =>
            cleanValue(
                row[currentFilterColumn]
            ) ===
            currentFilterValue
    );

}


function applyFilters() {

    filteredData =
        computeFilteredData();

    renderEverything();

}


function clearFilters() {

    currentFilterColumn = "";

    currentFilterValue = "";


    document.getElementById(
        "filterColumn"
    ).value = "";


    document.getElementById(
        "filterValue"
    ).innerHTML =
        '<option value="">Todos</option>';


    updateFilterHint();


    filteredData =
        [...allData];


    renderEverything();

}


/* =========================================================
   MODO DE VISUALIZAÇÃO DOS GRÁFICOS
   (Barras / Setores / Pontos / Linhas / Ogiva)
========================================================= */

function getChartMode(key) {

    return chartViewModes[key] || "bar";

}


function buildViewToggle(key) {

    const current =
        getChartMode(key);

    const buttons =
        Object.keys(CHART_VIEW_LABELS)
            .map(type => {

                const active =
                    type === current
                        ? " active"
                        : "";

                return (
                    '<button type="button" class="view-toggle-btn' +
                    active +
                    '" data-type="' +
                    type +
                    '">' +
                    CHART_VIEW_LABELS[type] +
                    "</button>"
                );

            })
            .join("");

    return (
        '<div class="view-toggle" data-chart-key="' +
        key +
        '">' +
        buttons +
        "</div>"
    );

}


function wireViewToggle(
    toggleElement,
    onChange
) {

    if (!toggleElement) {
        return;
    }

    const key =
        toggleElement.dataset.chartKey;


    toggleElement
        .querySelectorAll("button")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const type =
                        button.dataset.type;

                    if (getChartMode(key) === type) {
                        return;
                    }

                    chartViewModes[key] = type;

                    toggleElement
                        .querySelectorAll("button")
                        .forEach(btn =>
                            btn.classList.toggle(
                                "active",
                                btn === button
                            )
                        );

                    onChange(type);

                }
            );

        });

}


function setupViewToggles() {

    const overviewHeading =
        document.getElementById(
            "overviewChartHeading"
        );

    if (overviewHeading) {

        overviewHeading.insertAdjacentHTML(
            "beforeend",
            buildViewToggle("overview_main")
        );

        wireViewToggle(
            overviewHeading.querySelector(".view-toggle"),
            () =>
                renderVerticalChart(
                    "mainCategoryChart",
                    findBestCategoricalColumn(),
                    12,
                    "overview_main"
                )
        );

    }


    const histogramHeading =
        document.getElementById(
            "histogramChartHeading"
        );

    if (histogramHeading) {

        histogramHeading.insertAdjacentHTML(
            "beforeend",
            buildViewToggle("histogram")
        );

        wireViewToggle(
            histogramHeading.querySelector(".view-toggle"),
            () => {

                const column =
                    document.getElementById(
                        "statVariable"
                    ).value;

                if (column) {

                    if (getNumericColumns().includes(column)) {
                        renderHistogram(getNumericValues(column), column);
                    }

                }

            }
        );

    }

}


/*
   Paleta usada nos "Setores" (pizza). Cicla pelos tons
   oficiais da marca e algumas variações derivadas, então
   funciona bem mesmo com muitas categorias.
*/

const BRAND_PALETTE = [
    "#0F3D2E",
    "#4E6B4A",
    "#5B4636",
    "#9C8F7D",
    "#7C9174",
    "#2F5C46",
    "#8A6F53",
    "#3E2E22",
    "#B7AA92",
    "#6B8564",
    "#78573F",
    "#D8CBB3"
];


function buildPalette(count) {

    return Array.from(
        { length: count },
        (_, index) =>
            BRAND_PALETTE[
                index % BRAND_PALETTE.length
            ]
    );

}


/*
   Monta o "dataset" do Chart.js para os modos cartesianos
   (Barras / Linhas / Pontos). "options.noGap" remove o
   espaçamento entre barras — usado no histograma.
*/

function buildChartDataset(
    mode,
    label,
    data,
    options = {}
) {

    const moss = "#4E6B4A";
    const forest = "#0F3D2E";


    if (mode === "line") {

        return {
            type: "line",
            label,
            data,
            fill: true,
            tension: .3,
            borderWidth: 2,
            borderColor: moss,
            backgroundColor: "rgba(78,107,74,.18)",
            pointBackgroundColor: forest,
            pointBorderColor: forest,
            pointRadius: 4
        };

    }


    if (mode === "points") {

        // Gráfico de pontos no estilo "pirulito": ponto grande com
        // contorno branco e uma haste fina até a linha de base.
        return {
            type: "line",
            label,
            data,
            showLine: false,
            borderWidth: 0,
            pointBackgroundColor: forest,
            pointBorderColor: "#FFFFFF",
            pointBorderWidth: 2,
            pointRadius: 8,
            pointHoverRadius: 10,
            pointHoverBorderWidth: 3
        };

    }


    const dataset = {
        type: "bar",
        label,
        data,
        backgroundColor: "rgba(78,107,74,.82)",
        borderColor: forest,
        borderWidth: 1,
        borderRadius: 5,
        maxBarThickness: 55
    };


    if (options.noGap) {

        dataset.categoryPercentage = 1;
        dataset.barPercentage = 1;
        dataset.borderRadius = 2;

    }


    return dataset;

}


/*
   Dataset da Ogiva: a mesma série, só que acumulada —
   por isso a ordenação correta das categorias (feita em
   sortChartEntries) é essencial para esse modo fazer sentido.
*/

function buildOgiveDataset(data, label) {

    let running = 0;

    const cumulative =
        data.map(
            value => (running += value)
        );

    return {
        type: "line",
        label: label + " acumuladas",
        data: cumulative,
        fill: true,
        tension: 0,
        borderWidth: 2,
        borderColor: "#5B4636",
        backgroundColor: "rgba(91,70,54,.15)",
        pointBackgroundColor: "#3E2E22",
        pointBorderColor: "#3E2E22",
        pointRadius: 4
    };

}


/*
   Plugin que desenha a haste (linha fina) de cada ponto até o
   eixo zero, deixando o gráfico de pontos mais legível.
*/

const POINT_STEMS_PLUGIN = {

    id: "pointStems",

    beforeDatasetsDraw(chart) {

        const meta =
            chart.getDatasetMeta(0);

        const yScale =
            chart.scales.y;

        if (!meta || !yScale) {
            return;
        }

        const base =
            yScale.getPixelForValue(0);

        const ctx =
            chart.ctx;

        ctx.save();

        ctx.strokeStyle =
            "rgba(78,107,74,.45)";

        ctx.lineWidth = 2;

        ctx.lineCap = "round";

        meta.data.forEach(point => {

            if (
                !point ||
                point.skip
            ) {
                return;
            }

            ctx.beginPath();

            ctx.moveTo(point.x, base);

            ctx.lineTo(point.x, point.y);

            ctx.stroke();

        });

        ctx.restore();

    }

};


/*
   Config completa do Chart.js para os modos cartesianos
   (Barras / Linhas / Pontos / Ogiva) — todos compartilham
   o mesmo eixo de categorias e o mesmo tooltip.
*/

function buildCartesianConfig(
    labels,
    dataset,
    total,
    tooltipUnit,
    extra = {}
) {

    const mode =
        extra.mode || "bar";

    const fullLabels =
        extra.fullLabels || null;

    // Em gráficos de linha/pontos/ogiva o Chart.js, por padrão,
    // encosta o primeiro ponto no eixo Y (margem 0). "offset"
    // reserva meia categoria de folga nas duas pontas.
    const isLineType =
        dataset.type === "line";

    const chartPlugins =
        mode === "points"
            ? [ChartDataLabels, POINT_STEMS_PLUGIN]
            : [ChartDataLabels];

    return {

        type: dataset.type,

        data: {
            labels,
            datasets: [dataset]
        },

        plugins: chartPlugins,

        options: {

            responsive: true,

            maintainAspectRatio: false,

            layout: {
                padding: {
                    top: 30,
                    left: 10,
                    right: 10,
                    bottom: 10
                }
            },

            plugins: {

                legend: {
                    display: false
                },

                tooltip: {
                    callbacks: {
                        // Mostra o rótulo completo (sem "...") no tooltip.
                        title: items => {

                            if (!items.length) {
                                return "";
                            }

                            const index =
                                items[0].dataIndex;

                            return (
                                fullLabels &&
                                fullLabels[index] !== undefined
                            )
                                ? fullLabels[index]
                                : items[0].label;

                        },
                        label: context => {

                            const value =
                                context.raw;

                            const percentage =
                                total
                                    ? (
                                        value /
                                        total *
                                        100
                                    ).toFixed(1)
                                    : 0;

                            return (
                                " " +
                                value +
                                " " +
                                tooltipUnit +
                                " (" +
                                percentage +
                                "%)"
                            );

                        }
                    }
                },

                datalabels: {
                    anchor: "end",
                    align: "top",
                    offset: mode === "points" ? 6 : 4,
                    color: "#3E2E22",
                    font: {
                        weight: "bold",
                        size: 11
                    },
                    formatter: value => value
                }

            },

            scales: {

                x: {
                    offset: true,
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: "#5B4636",
                        font: { size: 10 },
                        maxRotation: 45,
                        minRotation: 0
                    }
                },

                y: {
                    beginAtZero: true,
                    grace: isLineType ? "12%" : 0,
                    ticks: {
                        precision: 0,
                        color: "#756C5E"
                    },
                    grid: {
                        color: "rgba(91,70,54,.12)"
                    }
                }

            }

        }

    };

}


/*
   Config do Chart.js para os "Setores" (pizza) — sem
   eixos, com legenda e rótulos em porcentagem.
*/

function buildPieConfig(
    labels,
    data,
    datasetLabel,
    total,
    tooltipUnit
) {

    return {

        type: "pie",

        data: {
            labels,
            datasets: [
                {
                    label: datasetLabel,
                    data,
                    backgroundColor:
                        buildPalette(data.length),
                    borderColor: "#FFFFFF",
                    borderWidth: 2
                }
            ]
        },

        plugins: [ChartDataLabels],

        options: {

            responsive: true,

            maintainAspectRatio: false,

            plugins: {

                legend: {
                    display: true,
                    position: "right",
                    labels: {
                        color: "#5B4636",
                        boxWidth: 12,
                        font: { size: 10 }
                    }
                },

                tooltip: {
                    callbacks: {
                        label: context => {

                            const value =
                                context.raw;

                            const percentage =
                                total
                                    ? (
                                        value /
                                        total *
                                        100
                                    ).toFixed(1)
                                    : 0;

                            return (
                                " " +
                                context.label +
                                ": " +
                                value +
                                " " +
                                tooltipUnit +
                                " (" +
                                percentage +
                                "%)"
                            );

                        }
                    }
                },

                datalabels: {
                    color: "#FFFFFF",
                    textStrokeColor: "rgba(35,38,31,.45)",
                    textStrokeWidth: 2,
                    font: { weight: "bold", size: 11 },
                    formatter: value => {

                        const percentage =
                            total
                                ? Math.round(
                                    value / total * 100
                                )
                                : 0;

                        return percentage + "%";

                    }
                }

            }

        }

    };

}


function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

}


/*
   Despachante único: recebe {labels, data} de QUALQUER
   gráfico (categórico ou histograma) e desenha o modo
   escolhido — Barras, Setores, Pontos, Linhas, Ogiva ou
   trocando o tipo de gráfico exibido no <canvas>.
*/

function renderChartByMode({
    container,
    canvasId,
    mode,
    labels,
    data,
    total,
    datasetLabel,
    tooltipUnit,
    noGap = false,
    fullLabels = null
}) {

    const canvas =
        document.getElementById(canvasId);

    if (!canvas) {
        return;
    }

    destroyChart(canvasId);


    if (mode === "pie") {

        charts[canvasId] =
            new Chart(
                canvas,
                buildPieConfig(
                    labels,
                    data,
                    datasetLabel,
                    total,
                    tooltipUnit
                )
            );

        return;

    }


    const dataset =
        mode === "ogive"
            ? buildOgiveDataset(data, datasetLabel)
            : buildChartDataset(
                mode,
                datasetLabel,
                data,
                { noGap }
            );


    charts[canvasId] =
        new Chart(
            canvas,
            buildCartesianConfig(
                labels,
                dataset,
                total,
                tooltipUnit,
                {
                    mode,
                    fullLabels
                }
            )
        );

}


/*
   Detecta se os rótulos de um gráfico são faixas
   numéricas ("10-50", "51-100", "501+"...) e, se forem,
   reordena pelo valor da faixa em vez da frequência —
   assim a Ogiva e a leitura geral fazem sentido.
*/

function extractFirstNumber(text) {

    const match =
        text.match(
            /\d{1,3}(?:\.\d{3})+|\d+(?:,\d+)?/
        );

    if (!match) {
        return null;
    }

    let raw = match[0];

    if (raw.includes(".")) {
        raw = raw.replace(/\./g, "");
    } else {
        raw = raw.replace(",", ".");
    }

    const value = Number(raw);

    return Number.isFinite(value) ? value : null;

}


function parseOrdinalKey(label) {

    const text = normalize(label);

    const number = extractFirstNumber(text);

    if (number === null) {
        return null;
    }

    const isLowerBound =
        /\b(mais de|acima de|superior a|ou mais)\b/.test(text) ||
        /\+\s*$/.test(text.trim());

    const isUpperBound =
        /\b(menos de|ate|abaixo de|inferior a)\b/.test(text);

    if (isLowerBound) {
        return number + .5;
    }

    if (isUpperBound) {
        return number - .5;
    }

    return number;

}


function sortChartEntries(entries) {

    if (entries.length < 2) {
        return entries;
    }

    const keys =
        entries.map(
            ([label]) => parseOrdinalKey(label)
        );

    const parsedCount =
        keys.filter(key => key !== null).length;

    const looksOrdinal =
        parsedCount === entries.length;

    if (!looksOrdinal) {
        return entries;
    }

    return entries
        .map((entry, index) => ({
            entry,
            key: keys[index]
        }))
        .sort((a, b) => a.key - b.key)
        .map(item => item.entry);

}


/* =========================================================
   TOTAL DE RESPONDENTES POR PERGUNTA
========================================================= */

/*
   Quantas pessoas responderam a pergunta (célula não vazia),
   considerando o filtro atualmente aplicado.
*/

function countAnswered(column) {

    return filteredData.reduce(
        (count, row) =>
            cleanValue(row[column])
                ? count + 1
                : count,
        0
    );

}


function buildRespondentsBadge(column) {

    const answered =
        countAnswered(column);

    const total =
        filteredData.length;

    const detail =
        answered < total
            ? "pessoas responderam (de " + total + ")"
            : "pessoas responderam";

    return (
        '<div class="n-badge" title="' +
        answered +
        " de " +
        total +
        ' pessoas responderam esta pergunta">' +
        "<strong>N = " +
        answered +
        "</strong>" +
        "<span>" +
        detail +
        "</span>" +
        "</div>"
    );

}


/*
   Atualiza um cabeçalho que já existe no HTML (visão geral,
   histograma): "badge" recebe o N e "question" recebe
   o texto completo da pergunta.
*/

function updateHeadingInfo(
    badgeId,
    questionId,
    column
) {

    const badge =
        document.getElementById(badgeId);

    if (badge) {

        badge.innerHTML =
            column
                ? buildRespondentsBadge(column)
                : "";

    }

    const question =
        document.getElementById(questionId);

    if (question && column) {

        question.textContent =
            column;

        question.title =
            column;

    }

}


/* =========================================================
   VISÃO GERAL
========================================================= */

function renderOverview() {

    document.getElementById(
        "metricTotal"
    ).textContent =
        filteredData.length;


    document.getElementById(
        "metricColumns"
    ).textContent =
        headers.filter(
            h =>
                h &&
                !isTimestamp(h)
        ).length;


    const raceColumn =
        findColumn([
            "raça",
            "raca"
        ]);


    const purposeColumn =
        findColumn([
            "finalidade"
        ]);


    document.getElementById(
        "metricRace"
    ).textContent =
        raceColumn
            ? getMode(raceColumn)
            : "—";


    document.getElementById(
        "metricPurpose"
    ).textContent =
        purposeColumn
            ? getMode(purposeColumn)
            : "—";


    const categoryColumn =
        findBestCategoricalColumn();


    if (categoryColumn) {

        renderVerticalChart(
            "mainCategoryChart",
            categoryColumn,
            12,
            "overview_main"
        );

        updateHeadingInfo(
            "overviewN",
            "overviewQuestion",
            categoryColumn
        );

    }


    renderSummary();

}


function renderSummary() {

    const container =
        document.getElementById(
            "summaryList"
        );


    const categorical =
        getCategoricalColumns()
            .slice(0, 8);


    if (!categorical.length) {

        container.innerHTML =
            "<p>Nenhuma variável categórica encontrada.</p>";

        return;

    }


    container.innerHTML =
        categorical
            .map(
                column => {

                    return `

                        <div class="summary-item">

                            <span>
                                ${escapeHTML(shortenHeader(column))}
                                <small class="summary-n">
                                    ${countAnswered(column)} de ${filteredData.length} responderam
                                </small>
                            </span>

                            <strong>
                                ${escapeHTML(getMode(column))}
                            </strong>

                        </div>

                    `;

                }
            )
            .join("");

}


/* =========================================================
   PÁGINAS TEMÁTICAS
========================================================= */

function renderRebanho() {

    renderCategoryPage(
        "rebanhoCharts",
        [
            "raça",
            "raca",
            "peso",
            "gado",
            "animal",
            "rebanho",
            "finalidade",
            "identifica"
        ]
    );

}


function renderAlimentacao() {

    renderCategoryPage(
        "alimentacaoCharts",
        [
            "alimento",
            "alimentação",
            "alimentacao",
            "ração",
            "racao",
            "água",
            "agua",
            "suplement",
            "gasto"
        ]
    );

}


function renderSaude() {

    renderCategoryPage(
        "saudeCharts",
        [
            "saúde",
            "saude",
            "vacina",
            "veterin",
            "parasita",
            "mortal",
            "problema",
            "limpeza",
            "manejo"
        ]
    );

}


function renderAmbiente() {

    renderCategoryPage(
        "ambienteCharts",
        [
            "ambiente",
            "pastagem",
            "temperatura",
            "calor",
            "água",
            "agua",
            "seca",
            "sombra",
            "área",
            "area"
        ]
    );

}


function renderCategoryPage(
    containerId,
    keywords
) {

    const container =
        document.getElementById(
            containerId
        );


    const columns =
        headers.filter(
            column => {

                if (
                    isTimestamp(column)
                ) {

                    return false;

                }


                const normalized =
                    normalize(column);


                return keywords.some(
                    keyword =>
                        normalized.includes(
                            normalize(keyword)
                        )
                );

            }
        );


    if (!columns.length) {

        container.innerHTML = `

            <div class="paper-card">

                <h3>
                    Nenhuma coluna encontrada
                </h3>

                <p>
                    Não foi encontrada uma pergunta
                    relacionada a esta seção na planilha.
                </p>

            </div>

        `;

        return;

    }


    container.innerHTML =
        columns
            .slice(0, 10)
            .map(
                column => {

                    const id =
                        "chart_" +
                        Math.random()
                            .toString(36)
                            .slice(2);


                    return `

                        <div class="paper-card">

                            <div class="card-heading">

                                <div>

                                    <h3
                                        class="question-title"
                                        title="${escapeHTML(column)}"
                                    >
                                        ${escapeHTML(shortenHeader(column))}
                                    </h3>

                                    <p>
                                        Comparação das respostas
                                    </p>

                                    ${buildRespondentsBadge(column)}

                                </div>

                                ${buildViewToggle(column)}

                            </div>

                            <div class="chart-container">

                                <canvas
                                    id="${id}"
                                ></canvas>

                            </div>

                        </div>

                    `;

                }
            )
            .join("");


    // Os canvases antigos foram descartados: libera os gráficos
    // que ficaram presos a eles.
    pruneCharts();


    columns
        .slice(0, 10)
        .forEach(
            (column, index) => {

                const cards =
                    container
                        .querySelectorAll(
                            ".paper-card"
                        );

                const card =
                    cards[index];

                if (!card) {
                    return;
                }


                const canvas =
                    card.querySelector(
                        "canvas"
                    );

                if (!canvas) {
                    return;
                }


                renderVerticalChart(
                    canvas.id,
                    column,
                    12
                );


                wireViewToggle(
                    card.querySelector(
                        ".view-toggle"
                    ),
                    () =>
                        renderVerticalChart(
                            canvas.id,
                            column,
                            12
                        )
                );

            }
        );

}


/* =========================================================
   GRÁFICO VERTICAL
========================================================= */

function renderVerticalChart(
    canvasId,
    column,
    maxCategories = 12,
    viewKey = column
) {

    const canvas =
        document.getElementById(
            canvasId
        );


    if (!canvas) {
        return;
    }

    const container =
        canvas.parentElement;


    const counts =
        countValues(
            filteredData,
            column
        );


    let entries =
        Object.entries(counts)
            .sort(
                (a,b) =>
                    b[1] - a[1]
            );


    entries =
        entries.slice(
            0,
            maxCategories
        );


    if (!entries.length) {

        // Nenhuma resposta (ex.: filtro sem resultados): remove o
        // gráfico antigo para não mostrar dados desatualizados.
        destroyChart(canvasId);

        return;

    }


    entries =
        sortChartEntries(
            entries
        );


    const labels =
        entries.map(
            entry =>
                shortenValue(
                    entry[0]
                )
        );


    const data =
        entries.map(
            entry =>
                entry[1]
        );


    const total =
        data.reduce(
            (a,b) => a+b,
            0
        );


    const mode =
        getChartMode(
            viewKey
        );


    renderChartByMode({
        container,
        canvasId,
        mode,
        labels,
        data,
        total,
        datasetLabel: "Respostas",
        tooltipUnit: "respostas",
        fullLabels:
            entries.map(
                entry =>
                    entry[0]
            )
    });

}


/* =========================================================
   ESTATÍSTICA
========================================================= */

function setupStatistics() {

    document
        .getElementById(
            "statVariable"
        )
        .addEventListener(
            "change",
            updateStatistics
        );

}


function clearNumericPanels(message) {

    const html =
        '<p class="panel-empty">' +
        escapeHTML(message) +
        "</p>";

    [
        "statistics",
        "frequencyTable",
        "descriptiveTable"
    ].forEach(id => {

        const element =
            document.getElementById(id);

        if (element) {
            element.innerHTML = html;
        }

    });

}


function rebuildStatisticsVariables() {

    const select =
        document.getElementById(
            "statVariable"
        );


    // O seletor do histograma deve listar todas as perguntas
    // disponíveis (como o filtro), não apenas as numéricas.
    const availableColumns = headers.filter(
        column => column && !isTimestamp(column) && !isIgnoredColumn(column)
    );

    // Guarda a pergunta escolhida para não "voltar ao início"
    // quando os dados são atualizados.
    const previousSelection =
        select.value;

    select.innerHTML = "";

    if (!availableColumns.length) {
        select.innerHTML = '<option value="">Nenhuma pergunta encontrada</option>';
        return;
    }

    availableColumns.forEach(
        column => {

            const option =
                document.createElement(
                    "option"
                );


            option.value =
                column;


            option.textContent =
                shortenHeader(column);

            option.title =
                column;


            select.appendChild(
                option
            );

        }
    );


    if (
        previousSelection &&
        availableColumns.includes(previousSelection)
    ) {

        select.value =
            previousSelection;

    }


    updateStatistics();

}


function updateStatistics() {

    const select =
        document.getElementById(
            "statVariable"
        );


    const column =
        select.value;


    if (!column) {
        return;
    }


    const values = getNumericValues(column);
    const numericColumn = getNumericColumns().includes(column);

    // Pergunta completa + total de respondentes nos cabeçalhos.
    updateHeadingInfo("histogramN", "histogramQuestion", column);

    // Para perguntas categóricas/textuais, mostrar frequências no gráfico;
    // estatísticas numéricas só são calculadas quando a variável é numérica.
    if (!numericColumn) {

        // Evita mostrar estatísticas da pergunta anterior.
        clearNumericPanels(
            "Esta pergunta não é numérica: o histograma mostra a frequência das respostas, " +
            "e as medidas estatísticas só estão disponíveis para variáveis numéricas."
        );

        const frequencies = new Map();
        filteredData.forEach(row => {
            const answer = String(row[column] ?? '').trim();
            if (answer) frequencies.set(answer, (frequencies.get(answer) || 0) + 1);
        });
        const entries = [...frequencies.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30);
        renderChartByMode({
            container: document.getElementById('histogramChart').parentElement,
            canvasId: 'histogramChart',
            mode: getChartMode('histogram'),
            labels: entries.map(entry => shortenValue(entry[0])),
            data: entries.map(entry => entry[1]),
            total: entries.reduce((sum, entry) => sum + entry[1], 0),
            datasetLabel: 'Respostas',
            tooltipUnit: 'respostas',
            fullLabels: entries.map(entry => entry[0])
        });
        return;
    }

    if (!values.length) {

        clearNumericPanels(
            "Ainda não há valores numéricos para esta pergunta."
        );

        destroyChart("histogramChart");

        return;

    }

    const statistics =
        calculateStatistics(
            values
        );


    renderStatisticsCards(
        statistics
    );


    renderHistogram(
        values,
        column
    );


    renderFrequencyTable(
        values
    );


    renderDescriptiveTable(
        statistics
    );

}


/* =========================================================
   CÁLCULOS ESTATÍSTICOS
========================================================= */

function calculateStatistics(values) {

    const sorted =
        [...values]
            .sort(
                (a,b) => a-b
            );


    const n =
        sorted.length;


    const mean =
        sorted.reduce(
            (a,b) => a+b,
            0
        ) / n;


    const median =
        calculateMedian(
            sorted
        );


    const q1 =
        calculateQuantile(
            sorted,
            .25
        );


    const q3 =
        calculateQuantile(
            sorted,
            .75
        );


    const min =
        sorted[0];


    const max =
        sorted[n - 1];


    const variance =
        sorted.reduce(
            (sum, value) =>
                sum +
                Math.pow(
                    value - mean,
                    2
                ),
            0
        ) / n;


    const standardDeviation =
        Math.sqrt(
            variance
        );


    const iqr =
        q3 - q1;


    const lowerLimit =
        q1 -
        1.5 *
        iqr;


    const upperLimit =
        q3 +
        1.5 *
        iqr;


    const outliers =
        sorted.filter(
            value =>
                value < lowerLimit ||
                value > upperLimit
        );


    return {

        n,

        mean,

        median,

        q1,

        q3,

        min,

        max,

        variance,

        standardDeviation,

        iqr,

        lowerLimit,

        upperLimit,

        outliers

    };

}


function calculateMedian(
    sorted
) {

    const n =
        sorted.length;


    const middle =
        Math.floor(
            n / 2
        );


    if (
        n % 2 === 0
    ) {

        return (
            sorted[middle - 1] +
            sorted[middle]
        ) / 2;

    }


    return sorted[middle];

}


function calculateQuantile(
    sorted,
    q
) {

    if (!sorted.length) {
        return 0;
    }


    const position =
        (sorted.length - 1) *
        q;


    const lower =
        Math.floor(position);


    const upper =
        Math.ceil(position);


    if (
        lower === upper
    ) {

        return sorted[lower];

    }


    return (
        sorted[lower] +
        (
            sorted[upper] -
            sorted[lower]
        ) *
        (
            position -
            lower
        )
    );

}


/* =========================================================
   CARDS ESTATÍSTICOS
========================================================= */

function renderStatisticsCards(
    stats
) {

    document.getElementById(
        "statistics"
    ).innerHTML = `

        <div class="stat">
            <span>N</span>
            <strong>${stats.n}</strong>
        </div>

        <div class="stat">
            <span>MÉDIA</span>
            <strong>${formatNumber(stats.mean)}</strong>
        </div>

        <div class="stat">
            <span>MEDIANA</span>
            <strong>${formatNumber(stats.median)}</strong>
        </div>

        <div class="stat">
            <span>Q1</span>
            <strong>${formatNumber(stats.q1)}</strong>
        </div>

        <div class="stat">
            <span>Q3</span>
            <strong>${formatNumber(stats.q3)}</strong>
        </div>

        <div class="stat">
            <span>DESVIO PADRÃO</span>
            <strong>${formatNumber(stats.standardDeviation)}</strong>
        </div>

    `;

}


/* =========================================================
   HISTOGRAMA
========================================================= */

function renderHistogram(
    values,
    column = ""
) {

    const canvas =
        document.getElementById(
            "histogramChart"
        );


    if (!canvas) {
        return;
    }

    const container =
        canvas.parentElement;


    const mode =
        getChartMode(
            "histogram"
        );


    const min =
        Math.min(...values);


    const max =
        Math.max(...values);


    let labels;
    let counts;

    // A pergunta "Quantidade de gado" usa exatamente as mesmas
    // faixas definidas na visualização categórica, evitando que o
    // histograma agrupe os mesmos dados em intervalos automáticos.
    const normalizedColumn = normalize(column);
    if (normalizedColumn.includes("quantidade de gado")) {
        const ranges = [
            { label: "10–50", min: 10, max: 50 },
            { label: "51–100", min: 51, max: 100 },
            { label: "101–200", min: 101, max: 200 },
            { label: "201–500", min: 201, max: 500 },
            { label: "501+", min: 501, max: Infinity }
        ];
        labels = ranges.map(range => range.label);
        counts = ranges.map(range => values.filter(value => value >= range.min && value <= range.max).length);
    } else if (min === max) {

        labels = [String(min)];
        counts = [values.length];

    } else {

        const bins =
            Math.min(
                10,
                Math.max(
                    5,
                    Math.ceil(
                        Math.sqrt(
                            values.length
                        )
                    )
                )
            );


        const width =
            (max - min) /
            bins;


        counts =
            new Array(bins)
                .fill(0);


        values.forEach(
            value => {

                let index =
                    Math.floor(
                        (value - min) /
                        width
                    );


                if (
                    index >= bins
                ) {

                    index =
                        bins - 1;

                }


                counts[index]++;

            }
        );


        labels =
            counts.map(
                (_, index) => {

                    const start =
                        min +
                        index *
                        width;


                    const end =
                        start +
                        width;


                    return (
                        formatNumber(start) +
                        " – " +
                        formatNumber(end)
                    );

                }
            );

    }


    renderChartByMode({
        container,
        canvasId: "histogramChart",
        mode,
        labels,
        data: counts,
        total: values.length,
        datasetLabel: "Frequência",
        tooltipUnit: "respostas",
        noGap: true
    });

}


/* =========================================================
   TABELA DE FREQUÊNCIA
========================================================= */

function renderFrequencyTable(
    values
) {

    const container =
        document.getElementById(
            "frequencyTable"
        );


    const frequencies = {};


    values.forEach(
        value => {

            const key =
                formatNumber(value);


            frequencies[key] =
                (
                    frequencies[key] ||
                    0
                ) + 1;

        }
    );


    const entries =
        Object.entries(
            frequencies
        )
        .sort(
            (a,b) =>
                Number(a[0]) -
                Number(b[0])
        );


    const total =
        values.length;


    let html = `

        <table>

            <thead>

                <tr>
                    <th>Valor</th>
                    <th>Frequência absoluta</th>
                    <th>Frequência relativa</th>
                    <th>Percentual</th>
                </tr>

            </thead>

            <tbody>

    `;


    entries.forEach(
        ([value, count]) => {

            const percentage =
                count /
                total *
                100;


            html += `

                <tr>

                    <td>
                        ${value}
                    </td>

                    <td>
                        ${count}
                    </td>

                    <td>
                        ${(
                            count /
                            total
                        ).toFixed(4)}
                    </td>

                    <td>
                        ${percentage.toFixed(2)}%
                    </td>

                </tr>

            `;

        }
    );


    html += `

            </tbody>

        </table>

    `;


    container.innerHTML =
        html;

}


/* =========================================================
   TABELA DESCRITIVA
========================================================= */

function renderDescriptiveTable(
    stats
) {

    document.getElementById(
        "descriptiveTable"
    ).innerHTML = `

        <table>

            <thead>

                <tr>

                    <th>Medida</th>

                    <th>Valor</th>

                </tr>

            </thead>

            <tbody>

                <tr>
                    <td>Mínimo</td>
                    <td>${formatNumber(stats.min)}</td>
                </tr>

                <tr>
                    <td>1º quartil (Q1)</td>
                    <td>${formatNumber(stats.q1)}</td>
                </tr>

                <tr>
                    <td>Mediana</td>
                    <td>${formatNumber(stats.median)}</td>
                </tr>

                <tr>
                    <td>3º quartil (Q3)</td>
                    <td>${formatNumber(stats.q3)}</td>
                </tr>

                <tr>
                    <td>Máximo</td>
                    <td>${formatNumber(stats.max)}</td>
                </tr>

                <tr>
                    <td>Amplitude</td>
                    <td>${formatNumber(stats.max - stats.min)}</td>
                </tr>

                <tr>
                    <td>Amplitude interquartil</td>
                    <td>${formatNumber(stats.iqr)}</td>
                </tr>

                <tr>
                    <td>Variância</td>
                    <td>${formatNumber(stats.variance)}</td>
                </tr>

                <tr>
                    <td>Desvio padrão</td>
                    <td>${formatNumber(stats.standardDeviation)}</td>
                </tr>

                <tr>
                    <td>Limite inferior de outlier</td>
                    <td>${formatNumber(stats.lowerLimit)}</td>
                </tr>

                <tr>
                    <td>Limite superior de outlier</td>
                    <td>${formatNumber(stats.upperLimit)}</td>
                </tr>

                <tr>
                    <td>Quantidade de outliers</td>
                    <td>${stats.outliers.length}</td>
                </tr>

            </tbody>

        </table>

    `;

}


/* =========================================================
   DETECÇÃO DE COLUNAS
========================================================= */

function getCategoricalColumns() {

    return headers.filter(
        column => {

            if (
                !column ||
                isTimestamp(column)
            ) {

                return false;

            }


            const values =
                filteredData
                    .map(
                        row =>
                            cleanValue(
                                row[column]
                            )
                    )
                    .filter(Boolean);


            if (!values.length) {
                return false;
            }


            const numericCount =
                values.filter(
                    value =>
                        parseNumber(value) !== null
                ).length;


            return (
                numericCount /
                values.length
            ) < .75;

        }
    );

}


function getNumericColumns() {

    return headers.filter(
        column => {

            if (
                !column ||
                isTimestamp(column)
            ) {

                return false;

            }


            const nonEmptyValues =
                allData
                    .map(
                        row =>
                            String(
                                row[column] ?? ""
                            ).trim()
                    )
                    .filter(
                        value =>
                            value !== ""
                    );


            if (!nonEmptyValues.length) {
                return false;
            }


            const numericValues =
                nonEmptyValues.filter(
                    value =>
                        parseNumber(value) !== null
                );


            return (
                numericValues.length /
                nonEmptyValues.length
            ) >= .8;

        }
    );

}


function findColumn(
    keywords
) {

    const columns =
        headers.filter(
            column =>
                !isTimestamp(column)
        );


    return columns.find(
        column => {

            const normalized =
                normalize(column);


            return keywords.some(
                keyword =>
                    normalized.includes(
                        normalize(keyword)
                    )
            );

        }
    ) || null;

}


function findBestCategoricalColumn() {

    const race =
        findColumn([
            "raça",
            "raca"
        ]);


    if (race) {
        return race;
    }


    const purpose =
        findColumn([
            "finalidade"
        ]);


    if (purpose) {
        return purpose;
    }


    return getCategoricalColumns()[0] || null;

}


/* =========================================================
   VALORES
========================================================= */

function getNumericValues(
    column
) {

    return filteredData
        .map(
            row =>
                parseNumber(
                    row[column]
                )
        )
        .filter(
            value =>
                value !== null
        );

}


function parseNumber(
    value
) {

    if (
        value === null ||
        value === undefined
    ) {

        return null;

    }


    let text =
        String(value)
            .trim();


    if (!text) {
        return null;
    }


    const normalized =
        text
            .replace(
                /R\$/gi,
                ""
            )
            .replace(
                /°C/gi,
                " "
            )
            .replace(
                /kg|ha|%|cm|m|mm|l|litros?/gi,
                " "
            )
            .replace(
                /\s+/g,
                " "
            )
            .trim();


    const numericMatches =
        normalized.match(
            /[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)/g
        );


    if (!numericMatches) {
        return null;
    }


    const numbers =
        numericMatches.map(
            value =>
                Number(
                    value.replace(
                        ",",
                        "."
                    )
                )
        );


    if (
        numbers.length > 1 &&
        numbers.every(
            number =>
                Number.isFinite(number)
        )
    ) {

        return (
            numbers.reduce(
                (sum, number) =>
                    sum + number,
                0
            ) /
            numbers.length
        );

    }


    const number =
        numbers[0];


    return Number.isFinite(number)
        ? number
        : null;

}


/* =========================================================
   FREQUÊNCIA
========================================================= */

function countValues(
    data,
    column
) {

    const result = {};


    data.forEach(
        row => {

            const value =
                cleanValue(
                    row[column]
                );


            if (!value) {
                return;
            }


            result[value] =
                (
                    result[value] ||
                    0
                ) + 1;

        }
    );


    return result;

}


function getMode(
    column
) {

    const counts =
        countValues(
            filteredData,
            column
        );


    const entries =
        Object.entries(
            counts
        );


    if (!entries.length) {
        return "—";
    }


    entries.sort(
        (a,b) =>
            b[1] - a[1]
    );


    return shortenValue(
        entries[0][0],
        25
    );

}


function uniqueValues(
    values
) {

    return [
        ...new Set(
            values
                .map(
                    value =>
                        cleanValue(value)
                )
                .filter(Boolean)
        )
    ]
    .sort(
        (a,b) =>
            a.localeCompare(
                b,
                "pt-BR"
            )
    );

}


/* =========================================================
   AUXILIARES
========================================================= */

function isTimestamp(
    header
) {

    const text =
        normalize(header);


    return (
        text.includes("carimbo") ||
        text.includes("timestamp") ||
        text.includes("data e hora")
    );

}


/*
   Identifica a coluna de e-mail criada automaticamente pelo
   Google Forms ("Endereço de e-mail"). Ela é descartada em
   loadData() para nunca aparecer no dashboard.
*/

function isIgnoredColumn(header) {
    // Oculta a coluna auxiliar identificada como "31" no Forms/CSV.
    const text = normalize(header);
    return /^(coluna\s*)?31[.)]?$/i.test(text);
}


function isEmailColumn(
    header
) {

    const text =
        normalize(header);


    return (
        text.includes("e-mail") ||
        text.includes("email")
    );

}


function normalize(
    value
) {

    return String(value ?? "")
        .normalize("NFD")
        .replace(
            /[\u0300-\u036f]/g,
            ""
        )
        .toLowerCase()
        .trim();

}


/*
   As perguntas NÃO são mais cortadas com "...": o texto completo
   é exibido e quebra em várias linhas quando necessário.
   (A função continua existindo para manter os pontos de uso.)
*/

function shortenHeader(
    text
) {

    return String(text ?? "");

}


function shortenValue(
    text,
    max = 28
) {

    text =
        String(text);


    if (
        text.length <= max
    ) {

        return text;

    }


    return (
        text.substring(
            0,
            max - 3
        ) +
        "..."
    );

}


function formatNumber(
    value
) {

    if (
        value === null ||
        value === undefined ||
        Number.isNaN(value)
    ) {

        return "—";

    }


    return Number(
        value
    ).toLocaleString(
        "pt-BR",
        {
            maximumFractionDigits: 2
        }
    );

}


function destroyChart(
    id
) {

    if (
        charts[id]
    ) {

        charts[id].destroy();

        delete charts[id];

    }

}


function pruneCharts() {

    Object.keys(charts).forEach(
        id => {

            if (
                !document.getElementById(id)
            ) {

                destroyChart(id);

            }

        }
    );

}


/* =========================================================
   ERRO
========================================================= */

function showError(
    message
) {

    const loading =
        document.getElementById(
            "loadingScreen"
        );


    loading.classList.remove(
        "hidden"
    );


    loading.innerHTML = `

        <h2>
            Não foi possível carregar os dados
        </h2>

        <p>
            ${message}
        </p>

        <p>
            Verifique se a planilha está publicada
            para a Web e tente novamente.
        </p>

    `;

}


/* =========================================================
   RENDERIZAÇÃO GERAL
========================================================= */

function renderEverything() {

    document.getElementById(
        "loadingScreen"
    ).classList.add(
        "hidden"
    );


    renderOverview();

    renderRebanho();

    renderAlimentacao();

    renderSaude();

    renderAmbiente();

    rebuildStatisticsVariables();

}
