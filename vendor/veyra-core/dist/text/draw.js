/**
 * Draws an element's text into a 2D canvas with the element's own font,
 * color, direction and the browser's own line breaks (read from the live
 * layout). Renderer-agnostic: use the canvas in Canvas2D, as a WebGL
 * texture (see `@veyra/core/three`'s `mirrorText`), or anywhere else.
 */
/**
 * Draws an element's text into a canvas with the element's own font,
 * color, direction and — crucially — the browser's own line breaks, read
 * from the live layout. The canvas maps 1:1 (times `scale`) to the
 * element's box plus `padding` on each side.
 */
export function drawElementText(el, options = {}) {
    const cs = getComputedStyle(el);
    const box = el.getBoundingClientRect();
    const fontSize = parseFloat(cs.fontSize) || 16;
    const pad = options.padding ?? Math.ceil(fontSize * 0.25);
    const scale = options.scale ?? 2;
    const canvas = options.canvas ?? document.createElement('canvas');
    canvas.width = Math.max(1, Math.ceil((box.width + pad * 2) * scale));
    canvas.height = Math.max(1, Math.ceil((box.height + pad * 2) * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx)
        return { canvas, padding: pad, width: box.width, height: box.height };
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    ctx.fillStyle = options.color ?? cs.color;
    ctx.direction = cs.direction === 'rtl' ? 'rtl' : 'ltr';
    const ls = cs.letterSpacing;
    if (ls && ls !== 'normal' && 'letterSpacing' in ctx)
        ctx.letterSpacing = ls;
    ctx.textBaseline = 'alphabetic';
    const ascent = ctx.measureText('Hgکی').fontBoundingBoxAscent || fontSize * 0.8;
    // Read the browser's line boxes: group word rects by line.
    const lines = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const node = n;
        // Skip visually hidden copies (e.g. splitText's screen-reader text).
        if (node.parentElement?.closest('[data-veyra-sr]'))
            continue;
        const re = /\S+/g;
        for (let m = re.exec(node.data); m; m = re.exec(node.data)) {
            range.setStart(node, m.index);
            range.setEnd(node, m.index + m[0].length);
            const rects = range.getClientRects();
            const r = rects[0];
            if (!r || r.width === 0)
                continue;
            let line = lines.find((l) => Math.abs(l.top - r.top) < fontSize * 0.5);
            if (!line) {
                line = { text: [], left: r.left, right: r.right, top: r.top };
                lines.push(line);
            }
            line.text.push(m[0]);
            line.left = Math.min(line.left, r.left);
            line.right = Math.max(line.right, r.right);
        }
    }
    range.detach?.();
    lines.sort((a, b) => a.top - b.top);
    for (const line of lines) {
        const text = line.text.join(' ');
        const y = line.top - box.top + pad + ascent;
        if (ctx.direction === 'rtl') {
            ctx.textAlign = 'right';
            ctx.fillText(text, line.right - box.left + pad, y);
        }
        else {
            ctx.textAlign = 'left';
            ctx.fillText(text, line.left - box.left + pad, y);
        }
    }
    return { canvas, padding: pad, width: box.width, height: box.height };
}
//# sourceMappingURL=draw.js.map