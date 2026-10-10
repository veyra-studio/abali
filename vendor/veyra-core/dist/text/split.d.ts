export type SplitType = 'lines' | 'words' | 'chars';
export interface SplitOptions {
    /** What to split into. Default `'words'`. Chars and lines imply words. */
    type?: SplitType | SplitType[];
    /**
     * Wrap lines and/or words in `overflow: hidden` masks for reveal effects.
     * `true` masks lines when splitting lines, otherwise words.
     */
    mask?: boolean | 'lines' | 'words';
    /** Extra room inside masks so ascenders/descenders aren't clipped. Default `'0.18em'`. */
    maskPadding?: string;
    /** Class names for generated elements. */
    classes?: Partial<Record<'line' | 'word' | 'char' | 'mask', string>>;
    /** Keep a visually hidden copy for assistive tech. Default `true`. */
    a11y?: boolean;
}
export interface SplitText {
    readonly el: HTMLElement;
    readonly direction: 'rtl' | 'ltr';
    /** Line elements (the inner, animatable element when masked). Empty unless lines were requested. */
    readonly lines: HTMLElement[];
    /** Word elements, in logical order. */
    readonly words: HTMLElement[];
    /** Character elements, in logical order. */
    readonly chars: HTMLElement[];
    /** Words grouped by visual line (available whenever lines were requested). */
    readonly lineWords: HTMLElement[][];
    /** Restores the original markup. */
    revert(): void;
    /** Re-splits with the same options — call after resize or font loading. */
    refresh(): void;
}
export declare function splitText(target: Element | string, options?: SplitOptions): SplitText;
//# sourceMappingURL=split.d.ts.map