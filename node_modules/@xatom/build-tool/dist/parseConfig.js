"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkFileExists = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const zod_1 = require("zod");
const checkFileExists = (configFilePath) => {
    return fs_1.default.existsSync(path_1.default.resolve(configFilePath));
};
exports.checkFileExists = checkFileExists;
const configZod = zod_1.z
    .object({
    webflowSubdomain: zod_1.z.string({
        invalid_type_error: "❌ webflowSubdomain: Invalid webflow subdomain",
        required_error: "❌ webflowSubdomain: Webflow subdomain is required",
    }),
    port: zod_1.z
        .number({
        invalid_type_error: "❌ port: Invalid port",
    })
        .default(3015),
    source: zod_1.z
        .string({
        invalid_type_error: "❌ source: Invalid source, example ./src",
    })
        .default("./src"),
    scriptList: zod_1.z
        .array(zod_1.z.string())
        .min(1, "minimum one dist file must be added"),
    dist: zod_1.z
        .string({
        invalid_type_error: "❌ source: Invalid source, example ./dist",
    })
        .default("./dist"),
    scriptAttribute: zod_1.z
        .string({
        invalid_type_error: "❌ scriptAttribute: invalid script attribute, example replace-script",
    })
        .default(""),
}, {
    required_error: "❌ Invalid configuration",
})
    .required({
    webflowSubdomain: true,
});
const parseConfig = (configPath) => {
    if (!(0, exports.checkFileExists)(configPath)) {
        console.warn("unable to locate config file: ", configPath);
        process.exit();
    }
    const configData = JSON.parse(fs_1.default.readFileSync(path_1.default.resolve(configPath)).toString());
    const config = configZod.safeParse(configData);
    if (!config.success) {
        const errors = config.error.format();
        console.log("xAtom config is invalid 🚨");
        console.log("");
        Object.keys(errors).forEach((key) => {
            if (Array.isArray(errors[key])) {
                errors[key].forEach((e) => console.log(e));
            }
            if (typeof errors[key] === "object" &&
                errors[key]._errors) {
                errors[key]._errors.forEach((e) => console.log(e));
            }
        });
        process.exit();
    }
    return config.data;
};
exports.default = parseConfig;
