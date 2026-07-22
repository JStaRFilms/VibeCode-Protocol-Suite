import { RESOURCES, readResourceFile } from './resource-files.mjs';

export function registerResources(server) {
  for (const resource of RESOURCES) {
    server.registerResource(resource.name, resource.uri, {
      mimeType: resource.mimeType,
      description: resource.description,
    }, async () => ({
      contents: [{
        uri: resource.uri,
        mimeType: resource.mimeType,
        text: readResourceFile(resource.file),
      }],
    }));
  }
}
