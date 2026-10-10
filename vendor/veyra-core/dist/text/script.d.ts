/**
 * Script and direction utilities: Unicode Arabic joining types (for
 * Persian, Arabic, Urdu, Kurdish…) and strong-direction detection.
 */
/**
 * Unicode joining type:
 * `D` dual-joining, `R` right-joining, `C` join-causing,
 * `T` transparent (combining marks), `U` non-joining.
 */
export type JoiningType = 'D' | 'R' | 'C' | 'T' | 'U';
/** The joining type of a single code point. */
export declare function joiningType(cp: number): JoiningType;
/** Joining type of a grapheme cluster: the type of its first non-transparent code point. */
export declare function clusterJoiningType(cluster: string): JoiningType;
export declare const ZWJ = "\u200D";
/** Splits text into grapheme clusters (user-perceived characters). */
export declare function graphemes(text: string): string[];
export interface ShapedCluster {
    /** The original characters of this unit. */
    text: string;
    /** The text to render in isolation so it keeps its contextual form. */
    display: string;
    joinsPrevious: boolean;
    joinsNext: boolean;
}
/**
 * Splits a word into renderable units that keep their joined (contextual)
 * forms when each unit is placed in its own box.
 *
 * Arabic-script letters normally lose their joining when wrapped in
 * separate inline-blocks — "سلام" falls apart into "س ل ا م". Each unit
 * here carries zero-width joiners on the sides where it connects, so the
 * browser still picks initial / medial / final forms. Lam + alef stays one
 * unit to preserve the mandatory ligature.
 */
export declare function shapeClusters(word: string): ShapedCluster[];
/** Direction of the first strong character in `text`, or `null` if none. */
export declare function strongDirection(text: string): 'rtl' | 'ltr' | null;
/** True if `text` contains Arabic-script characters (Persian, Arabic, Urdu…). */
export declare function hasArabicScript(text: string): boolean;
/** Resolved writing direction of an element. */
export declare function directionOf(el: Element): 'rtl' | 'ltr';
/**
 * `-1` for right-to-left elements, `1` otherwise. Multiply horizontal
 * motion by it so "forward" follows the reading direction:
 * `x: 40 * inlineSign(el)`.
 */
export declare function inlineSign(el: Element): 1 | -1;
/** Converts ASCII digits to Persian (Extended Arabic-Indic) digits. */
export declare function toPersianDigits(value: string | number): string;
//# sourceMappingURL=script.d.ts.map