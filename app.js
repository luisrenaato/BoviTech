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
   Atualização automática.

   30 segundos = 30000 ms
*/

const REFRESH_TIME =
    30000;


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
    ogive: "Ogiva",
    boxplot: "Boxplot"
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

        await loadData();

        setInterval(
            loadData,
            REFRESH_TIME
        );

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

async function loadData() {

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

                            if (isEmailColumn(header)) {
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
                    !isEmailColumn(header)
            );


        filteredData =
            [...allData];


        rebuildFilters();

        rebuildStatisticsVariables();

        renderEverything();


        setConnection(
            "online",
            "● Dados online"
        );


        document.getElementById(
            "lastUpdate"
        ).textContent =
            new Date().toLocaleTimeString(
                "pt-BR"
            );


    } catch(error) {

        console.error(error);


        setConnection(
            "offline",
            "● Erro ao carregar"
        );


        showError(
            error.message
        );

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


function applyFilters() {

    if (
        !currentFilterColumn ||
        !currentFilterValue
    ) {

        filteredData =
            [...allData];

    } else {

        filteredData =
            allData.filter(
                row =>
                    cleanValue(
                        row[currentFilterColumn]
                    ) ===
                    currentFilterValue
            );

    }


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


    filteredData =
        [...allData];


    renderEverything();

}


/* =========================================================
   MODO DE VISUALIZAÇÃO DOS GRÁFICOS
   (Barras / Setores / Pontos / Linhas / Ogiva / Boxplot)
========================================================= */

function getChartMode(key) {

    return chartViewModes[key] || "bar";

}


function buildViewToggle(key) {

    const canUseBoxplot =
        key &&
        getNumericColumns().includes(key);

    if (!canUseBoxplot) {
        chartViewModes[key] = "bar";
    }

    const current =
        canUseBoxplot
            ? getChartMode(key)
            : "bar";

    const buttons =
        Object.keys(CHART_VIEW_LABELS)
            .filter(type =>
                type !== "boxplot" || canUseBoxplot
            )
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

                    renderHistogram(
                        getNumericValues(column)
                    );

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

        return {
            type: "line",
            label,
            data,
            showLine: false,
            borderWidth: 0,
            pointBackgroundColor: forest,
            pointBorderColor: forest,
            pointRadius: 6,
            pointHoverRadius: 8
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
   Config completa do Chart.js para os modos cartesianos
   (Barras / Linhas / Pontos / Ogiva) — todos compartilham
   o mesmo eixo de categorias e o mesmo tooltip.
*/

function buildCartesianConfig(
    labels,
    dataset,
    total,
    tooltipUnit
) {

    return {

        type: dataset.type,

        data: {
            labels,
            datasets: [dataset]
        },

        plugins: [ChartDataLabels],

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


/*
   Monta o HTML do boxplot a partir de {min,q1,median,q3,max,outliers}.
   Reaproveitado tanto pela página de Estatística quanto pelo
   modo "Boxplot" disponível em cada gráfico.
*/

function buildBoxplotMarkup(stats, note = "") {

    const noteHTML =
        note
            ? `<div class="boxplot-note">${note}</div>`
            : "";


    const range =
        stats.max - stats.min;


    if (range === 0) {

        return `

            <div class="boxplot-wrapper">

                <div class="boxplot-axis"></div>

                <div
                    class="boxplot-box"
                    style="left:50%;width:0;"
                ></div>

                <div
                    class="boxplot-median"
                    style="left:50%;"
                ></div>

                <div
                    class="boxplot-label"
                    style="left:50%;"
                >
                    ${formatNumber(stats.median)}
                </div>

            </div>

            ${noteHTML}

        `;

    }


    const position =
        value =>
            5 +
            ((value - stats.min) / range) * 90;


    const minPos = position(stats.min);
    const q1Pos = position(stats.q1);
    const medPos = position(stats.median);
    const q3Pos = position(stats.q3);
    const maxPos = position(stats.max);

    const boxLeft = q1Pos;
    const boxWidth = q3Pos - q1Pos;
    const whiskerLeft = minPos;
    const whiskerWidth = maxPos - minPos;


    let outliersHTML = "";

    stats.outliers.forEach(
        value => {

            outliersHTML += `
                <div
                    class="boxplot-outlier"
                    style="left:${position(value)}%;"
                    title="Outlier: ${formatNumber(value)}"
                ></div>
            `;

        }
    );


    return `

        <div class="boxplot-wrapper">

            <div class="boxplot-axis"></div>

            <div
                class="boxplot-line"
                style="left:${whiskerLeft}%;width:${whiskerWidth}%;"
            ></div>

            <div class="boxplot-whisker" style="left:${minPos}%;"></div>
            <div class="boxplot-whisker" style="left:${maxPos}%;"></div>

            <div
                class="boxplot-box"
                style="left:${boxLeft}%;width:${boxWidth}%;"
            ></div>

            <div class="boxplot-median" style="left:${medPos}%;"></div>

            ${outliersHTML}

            <div class="boxplot-label" style="left:${minPos}%;">
                Min<br>${formatNumber(stats.min)}
            </div>

            <div class="boxplot-label" style="left:${q1Pos}%;">
                Q1<br>${formatNumber(stats.q1)}
            </div>

            <div class="boxplot-label" style="left:${medPos}%;">
                Med<br>${formatNumber(stats.median)}
            </div>

            <div class="boxplot-label" style="left:${q3Pos}%;">
                Q3<br>${formatNumber(stats.q3)}
            </div>

            <div class="boxplot-label" style="left:${maxPos}%;">
                Max<br>${formatNumber(stats.max)}
            </div>

        </div>

        ${noteHTML}

    `;

}


/*
   Despachante único: recebe {labels, data} de QUALQUER
   gráfico (categórico ou histograma) e desenha o modo
   escolhido — Barras, Setores, Pontos, Linhas, Ogiva ou
   Boxplot — trocando entre <canvas> e o boxplot inline.
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
    noGap = false
}) {

    const canvas =
        document.getElementById(canvasId);

    if (!canvas) {
        return;
    }

    const boxDiv =
        container.querySelector(".inline-boxplot");


    destroyChart(canvasId);


    if (mode === "boxplot") {

        canvas.classList.add("chart-hidden");
        container.classList.add("boxplot-active");

        if (boxDiv) {

            boxDiv.classList.add("active");

            const stats =
                calculateStatistics(data);

            boxDiv.innerHTML =
                buildBoxplotMarkup(
                    stats,
                    "Resumo estatístico dos valores deste gráfico (mín, Q1, mediana, Q3, máx)."
                );

        }

        return;

    }


    canvas.classList.remove("chart-hidden");
    container.classList.remove("boxplot-active");

    if (boxDiv) {
        boxDiv.classList.remove("active");
    }


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
                tooltipUnit
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
                                ${shortenHeader(column)}
                            </span>

                            <strong>
                                ${getMode(column)}
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

                                    <h3>
                                        ${shortenHeader(column)}
                                    </h3>

                                    <p>
                                        Comparação das respostas
                                    </p>

                                </div>

                                ${buildViewToggle(column)}

                            </div>

                            <div class="chart-container">

                                <canvas
                                    id="${id}"
                                ></canvas>

                                <div class="inline-boxplot"></div>

                            </div>

                        </div>

                    `;

                }
            )
            .join("");


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

    const boxplotData =
        mode === "boxplot"
            ? getNumericValues(column)
            : data;


    renderChartByMode({
        container,
        canvasId,
        mode,
        labels:
            mode === "boxplot"
                ? boxplotData
                : labels,
        data: boxplotData,
        total:
            mode === "boxplot"
                ? boxplotData.length
                : total,
        datasetLabel: "Respostas",
        tooltipUnit: "respostas"
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


function rebuildStatisticsVariables() {

    const select =
        document.getElementById(
            "statVariable"
        );


    const numeric =
        getNumericColumns();


    select.innerHTML = "";


    if (!numeric.length) {

        select.innerHTML =
            `
                <option>
                    Nenhuma variável numérica encontrada
                </option>
            `;

        return;

    }


    numeric.forEach(
        column => {

            const option =
                document.createElement(
                    "option"
                );


            option.value =
                column;


            option.textContent =
                shortenHeader(column);


            select.appendChild(
                option
            );

        }
    );


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


    const values =
        getNumericValues(
            column
        );


    if (!values.length) {

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
        values
    );


    renderBoxplot(
        values,
        statistics
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
    values
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


    if (min === max) {

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
   BOXPLOT
========================================================= */

function renderBoxplot(
    values,
    stats
) {

    const container =
        document.getElementById(
            "boxplot"
        );


    if (!container) {
        return;
    }


    container.innerHTML =
        buildBoxplotMarkup(
            stats
        );

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


function shortenHeader(
    text,
    max = 60
) {

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
