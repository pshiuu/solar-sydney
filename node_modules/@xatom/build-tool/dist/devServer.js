"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadDevServer = exports.loadProxyServer = void 0;
const openurl_1 = require("openurl");
const parseConfig_1 = __importDefault(require("./parseConfig"));
const core_1 = require("@parcel/core");
const path_1 = __importDefault(require("path"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const axios_1 = __importDefault(require("axios"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const express_ws_1 = __importDefault(require("express-ws"));
const events_1 = __importDefault(require("events"));
const prefixX = "⚛️  xAtom  👉";
const loadParcelDev = (src, dist, reloadEmitter, onInitCB) => {
    const bundler = new core_1.Parcel({
        entries: src,
        defaultConfig: "@parcel/config-default",
        shouldAutoInstall: true,
        shouldDisableCache: true,
        targets: {
            main: {
                engines: {
                    browsers: "> 0.5%, last 2 versions, not dead",
                },
                distDir: dist,
                context: "browser",
                isLibrary: false,
                optimize: false,
                sourceMap: true,
                includeNodeModules: true,
            },
        },
        // additionalReporters: [
        //   {
        //     packageName: "@parcel/reporter-cli",
        //     resolveFrom: __filename,
        //   },
        // ],
    });
    let init = false;
    bundler
        .watch((err, ev) => {
        if (err) {
            // fatal error
            throw err;
        }
        // console.log(ev);
        if (ev.type === "buildSuccess") {
            if (!init) {
                init = true;
                onInitCB();
            }
            let bundles = ev.bundleGraph.getBundles();
            reloadEmitter.emit("file-changes", bundles);
            console.log(prefixX, "Build done", `${ev.buildTime}ms |`, `Total ${bundles.length} bundles total `);
            bundles.forEach((bundle) => {
                console.log(prefixX, `Built ${bundle.displayName}`);
            });
        }
        else if (ev.type === "buildFailure") {
            console.log(prefixX, ev.diagnostics);
        }
    })
        .then(() => { })
        .catch((err) => {
        console.log(prefixX, "error", err);
    });
};
const loadProxyServer = (webflowSubdomain, port, distPath, scriptList, scriptToRemove, reloadEmitter) => {
    const app = (0, express_1.default)();
    const expressWsApp = (0, express_ws_1.default)(app);
    app.use((0, cors_1.default)({
        credentials: true,
        origin: [/.*/],
    }));
    app.use((0, cookie_parser_1.default)());
    app.use("/____xatom_js", express_1.default.static(path_1.default.resolve(distPath)));
    app.ws("/___xatom-reload", (ws, req) => {
        console.log(prefixX, "Auto Reload connection established");
    });
    reloadEmitter.on("file-changes", (data) => {
        expressWsApp.getWss().clients.forEach((client) => {
            client.send(`reload`);
        });
    });
    const reloadScript = /*html */ `<script>
    if ("WebSocket" in window) {
    (function(){
      const xAtomAutoReloadURL = "ws://localhost:${port}/___xatom-reload";
      const socket = new WebSocket(xAtomAutoReloadURL);
      socket.onmessage = function(event){
        if(event.data === "reload"){
          window.location.reload();
        }else
        console.log(event);
      }
    })()
  }
  </script>`;
    const finalScriptPaths = [
        reloadScript,
        scriptList.map((d) => `<script src="/____xatom_js/${d}"></script>`),
    ]
        .flat()
        .join("");
    app.get("*", (req, res) => {
        const startPref = Date.now();
        let isPage = false;
        axios_1.default
            .get(`https://${webflowSubdomain}.webflow.io${req.url}`, {
            headers: {
                Referer: `https://${webflowSubdomain}.webflow.io${req.path}`,
                "Referrer-Policy": "strict-origin-when-cross-origin",
                "User-Agent": req.headers["user-agent"],
                accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
                "accept-language": "en-US,en;q=0.9,it;q=0.8",
                "cache-control": "no-cache",
                pragma: "no-cache",
                "upgrade-insecure-requests": "1",
                Cookie: req.headers.cookie,
            },
            withCredentials: true,
        })
            .then((_res) => {
            const type = _res.headers["Content-Type"] ||
                _res.headers["content-type"];
            if (type === "text/html") {
                isPage = true;
                let dataHtml = _res.data;
                if (scriptToRemove.length) {
                    dataHtml = dataHtml.replace(new RegExp(`<script\\b[^>]*(?:${scriptToRemove}(?: {1}|="))\\b[^>]*>([\\s\\S]*?)<\\/script>`, "mg"), (e) => {
                        console.log(prefixX, "⚠️   Script Removed", e);
                        return "";
                    });
                }
                res.send(dataHtml.replace("</body>", `${finalScriptPaths}</body>`));
            }
            else
                res.send(_res.data);
        })
            .catch((err) => {
            console.log(prefixX, "Page not found", req.path);
            res.send(`${prefixX} page not found ${req.path} | status : ${err.message}`);
        })
            .finally(() => {
            const endPref = Date.now();
            if (isPage)
                console.log(prefixX, "Page", req.url, `took ${endPref - startPref}ms to fetch`);
        });
    });
    app.listen(port, () => {
        console.log(prefixX, `local server http://localhost:${port}`);
        (0, openurl_1.open)(`http://localhost:${port}`);
    });
};
exports.loadProxyServer = loadProxyServer;
const loadDevServer = (configFilePath) => {
    const config = (0, parseConfig_1.default)(configFilePath);
    const reloadEmitter = new events_1.default();
    console.log(prefixX, "Read Documentation 📚: https://xatom.js.org/");
    loadParcelDev(config.source, config.dist, reloadEmitter, () => {
        (0, exports.loadProxyServer)(config.webflowSubdomain, config.port, config.dist, config.scriptList, config.scriptAttribute, reloadEmitter);
    });
};
exports.loadDevServer = loadDevServer;
