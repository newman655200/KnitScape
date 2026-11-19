import { createServer } from 'vite';
// Memory-only diagnostic logging. No source file or project fact is modified.
const server = await createServer({ server: { host: '127.0.0.1', port: 5177, strictPort: true },
  plugins: [{ name: 'audit-export-error', enforce: 'pre', transform(code, id) {
    if (id.replaceAll('\\', '/').split('?')[0].endsWith('/src/actions/exporters.js')) {
      return code.replace('if (GLOBAL_STATE.projectExporting) return false;', 'console.info("P0_EXPORT_ENTER", GLOBAL_STATE.projectExporting); if (GLOBAL_STATE.projectExporting) return false;')
        .replace('const blob = await createProjectPackage(getProjectData());', 'console.info("P0_EXPORT_CAPTURED"); const blob = await createProjectPackage(getProjectData()); console.info("P0_EXPORT_BLOB", blob.size);')
        .replace('download(url, "pattern.knitscape");', 'download(url, "pattern.knitscape"); console.info("P0_EXPORT_CLICKED");')
        .replace('} catch (error) {', '} catch (error) { console.error("P0_EXPORT_DIAGNOSTIC", error.message, error.stack);');
    }
  } }] });
await server.listen(); server.printUrls();
