function processFile(storage, callback) {
    var xhr = new XMLHttpRequest();    
    xhr.onload = function(e) {
        if (xhr.status == 200) {
            callback(xhr.response, storage.options);
        }
    };
    xhr.open("GET", gcLocalServer + "/proxy?file=" + storage.content);
    xhr.responseType = "blob";
    xhr.send();
}

function renderFile(data, options) {
    const vscode = acquireVsCodeApi();
    var sheet = new wijmo.grid.sheet.FlexSheet("#sheet");
    wijmo.setCss(sheet.hostElement, { "font-family": "" });

    window.addEventListener("message", event => {
        if (event.data.refresh) {
            options.state = null;
            sheet.load(data);
        }
    });

    var busy = false, pending = false;
    
    function getState() {
        var sorts = [];
        var items = sheet.sortManager.sortDescriptions.items;
        for (var i = 0; i < items.length; i++) {
            var desc = items[i];
            sorts.push({
                columnIndex: desc.columnIndex,
                ascending: desc.ascending
            });
        }
        var state = {
            selectedSheetIndex: sheet.selectedSheetIndex,
            filterDefinition: sheet.filter.filterDefinition,
            sortDescriptions: JSON.stringify(sorts),
            scrollPosition: sheet.scrollPosition,
            version: "2.1.22"
        };
        return state;
    }

    function preserveState() {
        if (!busy) {
            busy = true;
            var state = getState();
            postState(gcLocalServer, state, function() {
                busy = false;
                if (pending) {
                    pending = false;
                    preserveState();
                }
            })
        } else {
            pending = true;
        }
    }

    function applyState() {
        var json = options.state;
        if (json && json.version) {
            if (json.selectedSheetIndex >= 0) {
                sheet.selectedSheetIndex = json.selectedSheetIndex;
            }
            sheet.filter.filterDefinition = json.filterDefinition;
            if (json.sortDescriptions) {
                var sorts = JSON.parse(json.sortDescriptions);
                sorts = sorts.map((s) => {
                    return new wijmo.grid.sheet.ColumnSortDescription(s.columnIndex, s.ascending);
                });
                sheet.sortManager.sortDescriptions = new wijmo.collections.CollectionView(sorts);
            }
            if (json.scrollPosition) {
                sheet.scrollPosition = json.scrollPosition;
            }
        }
    }

    var news = wijmo.getElement("[wj-part='new-sheet']");
    news.parentElement.removeChild(news);

    sheet.hostElement.addEventListener("contextmenu", e => {
        e.preventDefault();
    }, true);

    sheet.loaded.addHandler(() => {
        var style = getSheetStyle(sheet);
        sheet.sheets.forEach(s => {
            s.tables.forEach(t => {
                t.style = style;
            });
        });
        sheet.isReadOnly = true;
        sheet.showMarquee = false;
        applyState();

        setTimeout(() => {
            sheet.autoSizeColumn(0, true);
        }, 0);

        sheet.filter.filterApplied.addHandler(() => {
            preserveState();
        });
    
        sheet.selectedSheetChanged.addHandler(() => {
            preserveState();
            sheet.autoSizeColumn(0, true);
        });

        sheet.sortManager.sortDescriptions.collectionChanged.addHandler(() => {
            preserveState();
        });

        sheet.scrollPositionChanged.addHandler(() => {
            preserveState();
        });    
    });

    sheet.load(data);
}

function resizeSheet() {
    var div = wijmo.getElement("#sheet");
    div.style.height = window.innerHeight.toString() + "px";
}

function cssVar(name, value) {
    if (name.substr(0, 2) !== "--") {
        name = "--" + name;
    }
    if (value) {
        document.documentElement.style.setProperty(name, value)
    }
    return getComputedStyle(document.documentElement).getPropertyValue(name);
}

function getSheetStyle(sheet) {
    var style = sheet.getBuiltInTableStyle("TableStyleLight1");
    style.wholeTableStyle.borderTopColor = cssVar("vscode-editor-foreground");
    style.wholeTableStyle.borderBottomColor = cssVar("vscode-editor-foreground");
    style.wholeTableStyle.color = cssVar("vscode-editor-foreground");
    style.wholeTableStyle.backgroundColor = cssVar("vscode-editor-background");
    style.firstBandedRowStyle.color = cssVar("vscode-sideBar-foreground");
    style.firstBandedRowStyle.backgroundColor = cssVar("vscode-sideBar-background");
    style.firstBandedColumnStyle.color = cssVar("vscode-sideBar-foreground");
    style.firstBandedColumnStyle.backgroundColor = cssVar("vscode-sideBar-background");
    style.headerRowStyle.color = cssVar("vscode-titleBar-activeForeground");
    style.headerRowStyle.backgroundColor = cssVar("vscode-titleBar-activeBackground");
    style.headerRowStyle.borderBottomColor = cssVar("vscode-focusBorder");
    return style;
}