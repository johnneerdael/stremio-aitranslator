import { build } from "esbuild";
import { copy } from 'esbuild-plugin-copy';
import { readFileSync, rmSync } from "fs";

const start = Date.now();

try {
    const outdir = "dist";
    rmSync(outdir, { recursive: true, force: true });

    build({
        bundle: true,
        entryPoints: ["./src/index.js"],
        keepNames: true,
        loader: {
            ".css": "copy",
            ".html": "copy",
        },
        minify: true,
        outbase: "./src",
        outdir,
        platform: "node",
        plugins: [
            copy({
                assets: [
                    {
                        from: ['./static/**/*'],
                        to: ['./static'],
                    },
                ],
            })
        ],
    }).then(() => {
        console.log("⚡ \x1b[32m" + `Build completed in ${Date.now() - start}ms`);
    });
} catch (e) {
    console.error(e);
    process.exit(1);
} 