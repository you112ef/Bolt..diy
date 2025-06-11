import { cloudflareDevProxyVitePlugin as remixCloudflareDevProxy, vitePlugin as remixVitePlugin } from '@remix-run/dev';
import UnoCSS from 'unocss/vite';
import { defineConfig, type ViteDevServer } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { optimizeCssModules } from 'vite-plugin-optimize-css-modules';
import tsconfigPaths from 'vite-tsconfig-paths';
import * as dotenv from 'dotenv';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join, resolve as pathResolve } from 'path'; // Modified: import resolve as pathResolve and use it
import { injectManifest } from 'workbox-build'; // Added
import type { Plugin } from 'vite'; // Added for type safety

dotenv.config();

// Get detailed git info with fallbacks
const getGitInfo = () => {
  try {
    return {
      commitHash: execSync('git rev-parse --short HEAD').toString().trim(),
      branch: execSync('git rev-parse --abbrev-ref HEAD').toString().trim(),
      commitTime: execSync('git log -1 --format=%cd').toString().trim(),
      author: execSync('git log -1 --format=%an').toString().trim(),
      email: execSync('git log -1 --format=%ae').toString().trim(),
      remoteUrl: execSync('git config --get remote.origin.url').toString().trim(),
      repoName: execSync('git config --get remote.origin.url')
        .toString()
        .trim()
        .replace(/^.*github.com[:/]/, '')
        .replace(/\.git$/, ''),
    };
  } catch {
    return {
      commitHash: 'no-git-info',
      branch: 'unknown',
      commitTime: 'unknown',
      author: 'unknown',
      email: 'unknown',
      remoteUrl: 'unknown',
      repoName: 'unknown',
    };
  }
};

// Read package.json with detailed dependency info
const getPackageJson = () => {
  try {
    const pkgPath = join(process.cwd(), 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

    return {
      name: pkg.name,
      description: pkg.description,
      license: pkg.license,
      dependencies: pkg.dependencies || {},
      devDependencies: pkg.devDependencies || {},
      peerDependencies: pkg.peerDependencies || {},
      optionalDependencies: pkg.optionalDependencies || {},
    };
  } catch {
    return {
      name: 'bolt.diy',
      description: 'A DIY LLM interface',
      license: 'MIT',
      dependencies: {},
      devDependencies: {},
      peerDependencies: {},
      optionalDependencies: {},
    };
  }
};

const pkg = getPackageJson();
const gitInfo = getGitInfo();

export default defineConfig((config) => {
  return {
    define: {
      __COMMIT_HASH: JSON.stringify(gitInfo.commitHash),
      __GIT_BRANCH: JSON.stringify(gitInfo.branch),
      __GIT_COMMIT_TIME: JSON.stringify(gitInfo.commitTime),
      __GIT_AUTHOR: JSON.stringify(gitInfo.author),
      __GIT_EMAIL: JSON.stringify(gitInfo.email),
      __GIT_REMOTE_URL: JSON.stringify(gitInfo.remoteUrl),
      __GIT_REPO_NAME: JSON.stringify(gitInfo.repoName),
      __APP_VERSION: JSON.stringify(process.env.npm_package_version),
      __PKG_NAME: JSON.stringify(pkg.name),
      __PKG_DESCRIPTION: JSON.stringify(pkg.description),
      __PKG_LICENSE: JSON.stringify(pkg.license),
      __PKG_DEPENDENCIES: JSON.stringify(pkg.dependencies),
      __PKG_DEV_DEPENDENCIES: JSON.stringify(pkg.devDependencies),
      __PKG_PEER_DEPENDENCIES: JSON.stringify(pkg.peerDependencies),
      __PKG_OPTIONAL_DEPENDENCIES: JSON.stringify(pkg.optionalDependencies),
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
    },
    build: {
      target: 'esnext',
    },
    plugins: [
      nodePolyfills({
        include: ['buffer', 'process', 'util', 'stream'],
        globals: {
          Buffer: true,
          process: true,
          global: true,
        },
        protocolImports: true,
        exclude: ['child_process', 'fs', 'path'],
      }),
      {
        name: 'buffer-polyfill',
        transform(code, id) {
          if (id.includes('env.mjs')) {
            return {
              code: `import { Buffer } from 'buffer';\n${code}`,
              map: null,
            };
          }

          return null;
        },
      },
      config.mode !== 'test' && remixCloudflareDevProxy(),
      remixVitePlugin({
        future: {
          v3_fetcherPersist: true,
          v3_relativeSplatPath: true,
          v3_throwAbortReason: true,
          v3_lazyRouteDiscovery: true,
        },
      }),
      UnoCSS(),
      tsconfigPaths(),
      chrome129IssuePlugin(),
      config.mode === 'production' && optimizeCssModules({ apply: 'build' }),
      workboxPlugin(), // Added Workbox plugin
    ],
    envPrefix: [
      'VITE_',
      'OPENAI_LIKE_API_BASE_URL',
      'OLLAMA_API_BASE_URL',
      'LMSTUDIO_API_BASE_URL',
      'TOGETHER_API_BASE_URL',
    ],
    css: {
      preprocessorOptions: {
        scss: {
          api: 'modern-compiler',
        },
      },
    },
  };
});

function chrome129IssuePlugin() {
  return {
    name: 'chrome129IssuePlugin',
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        const raw = req.headers['user-agent']?.match(/Chrom(e|ium)\/([0-9]+)\./);

        if (raw) {
          const version = parseInt(raw[2], 10);

          if (version === 129) {
            res.setHeader('content-type', 'text/html');
            res.end(
              '<body><h1>Please use Chrome Canary for testing.</h1><p>Chrome 129 has an issue with JavaScript modules & Vite local development, see <a href="https://github.com/stackblitz/bolt.new/issues/86#issuecomment-2395519258">for more information.</a></p><p><b>Note:</b> This only impacts <u>local development</u>. `pnpm run build` and `pnpm run start` will work fine in this browser.</p></body>',
            );

            return;
          }
        }

        next();
      });
    },
  };
}

// Workbox Plugin Definition
function workboxPlugin(): Plugin {
  return {
    name: 'workbox-inject-manifest',
    apply: 'build',
    enforce: 'post',
    async closeBundle() {
      if (process.env.NODE_ENV === 'production') {
        const buildDir = pathResolve(__dirname, 'dist');
        // swSrc is tricky because the SW file might be in public and copied to dist,
        // or it might be in buildDir directly if it's processed by Vite.
        // Assuming sw.js is in public and will be copied to dist by Vite's publicDir handling.
        // Vite places files from `public` directory into the root of `buildDir`.
        const swSrc = pathResolve(buildDir, 'sw.js');

        console.log(`[Workbox] Using swSrc: ${swSrc}`);
        console.log(`[Workbox] Using buildDir: ${buildDir}`);

        try {
          const { count, size, warnings } = await injectManifest({
            swSrc: swSrc,
            swDest: swSrc, // Overwrite the source service worker file with the precache manifest injected
            globDirectory: buildDir,
            globPatterns: [
              // Match common static assets
              '**/*.{js,css,html,png,svg,jpg,jpeg,gif,webp,woff,woff2,ttf,eot,otf,ico}',
              // Explicitly include key files if they might not match above patterns
              'index.html',
              'offline.html', // Assuming you have this for offline fallback
              'manifest.json', // Your PWA manifest
              // Add patterns for any other critical assets, like icons in specific folders
              'assets/icons/*.png',
              'favicon.svg',
            ],
            globIgnores: [
              'node_modules/**/*', // Ignore node_modules
              'sw.js',             // Don't let sw.js precache itself directly via globPatterns
              '**/*.map',          // Ignore sourcemaps
              // Add any other files/patterns to ignore during precaching
            ],
            // Modify URL prefix if assets are served from a subdirectory
            // modifyURLPrefix: {
            //   'assets/': '/static/assets/'
            // },
            maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB limit per file
          });

          if (warnings.length > 0) {
            console.warn('[Workbox] Warnings during manifest injection:', warnings);
          }
          console.log(`[Workbox] Manifest injected: ${count} files, ${size / (1024 * 1024).toFixed(2)} MB precached.`);
        } catch (error) {
          console.error('[Workbox] Error during manifest injection:', error);
          // Optionally re-throw or handle to fail the build
          // throw error;
        }
      }
    },
  };
}