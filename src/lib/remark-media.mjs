import { visit } from 'unist-util-visit';

export function remarkEditorialMedia() {
  return (tree, file) => {
    // Only article images managed through Pages CMS use this source path.
    const filename = String(file.path || file.history?.[0] || '');
    if (!filename.replaceAll('\\', '/').includes('content/posts/')) return;

    visit(tree, 'image', node => {
      if (/^\/media\/[^/]+\.(avif|gif|jpe?g|png|webp)$/i.test(node.url)) {
        node.url = `../..${node.url}`;
      }
    });

    visit(tree, 'paragraph', (node, index, parent) => {
      if (!parent || index === undefined || node.children.length !== 1) return;
      const [image] = node.children;
      if (image.type !== 'image') return;
      const caption = image.title;
      delete image.title;
      parent.children[index] = {
        type: 'paragraph',
        data: { hName: 'figure' },
        children: [
          image,
          ...(caption ? [{ type: 'emphasis', data: { hName: 'figcaption' }, children: [{ type: 'text', value: caption }] }] : []),
        ],
      };
    });
  };
}
