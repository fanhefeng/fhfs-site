/** Hand-drawn centre lines, in writing order. No font outlines or Apple assets. */
export type HelloWord = "hello" | "nihao";

export const HELLO_WORDS = {
  hello: {
    lang: "en",
    viewBox: "0 0 680 320",
    width: 16,
    lift: 0,
    strokes: [
      // h: the entrance, tall loop, downstroke and shoulder.
      "M72 241 C101 218 160 116 171 73 C185 19 143 35 131 91 C121 137 125 216 116 252 C130 219 158 181 177 197 C193 211 159 251 185 253 C200 254 210 242 222 226",
      // e: a small counter, then a continuous join into the first l.
      "M222 226 C244 220 286 187 262 175 C240 164 220 189 220 217 C220 251 249 261 273 246 C289 236 306 217 319 202",
      // l, l: loops are drawn upwards first, then back to the baseline.
      "M319 202 C342 175 387 92 375 57 C363 22 329 53 327 122 C325 181 320 250 347 252 C367 254 386 218 399 201",
      "M399 201 C421 175 467 91 455 56 C443 20 409 55 407 124 C405 183 400 251 428 252 C448 253 472 218 487 196",
      // o: close the counter, then finish with a lifted exit stroke.
      "M487 196 C512 166 558 183 551 221 C545 258 507 266 487 239 C469 215 483 181 506 179 C537 176 551 199 558 207 C574 214 599 204 615 187",
    ],
  },
  nihao: {
    lang: "zh-CN",
    viewBox: "0 0 680 320",
    width: 13,
    lift: 0.075,
    strokes: [
      // 你: 亻, then 尔. Separate strokes preserve the pen lifts.
      "M155 64 Q137 111 106 143",
      "M134 115 Q129 183 131 255",
      "M207 66 Q191 111 170 132",
      "M196 104 Q244 96 284 99 Q275 118 263 131",
      "M229 128 Q231 191 226 247 Q224 263 204 249",
      "M191 163 Q177 197 158 215",
      "M256 162 Q280 186 292 211",
      // 好: 女, then 子.
      "M384 74 Q368 139 350 178 Q386 183 415 218",
      "M335 132 Q384 127 426 126 Q414 205 344 250",
      "M339 211 Q389 194 430 178",
      "M451 92 Q507 80 554 88 Q530 122 504 139",
      "M504 139 Q518 175 510 236 Q507 263 481 243",
      "M437 170 Q502 160 573 157",
    ],
  },
} as const;
