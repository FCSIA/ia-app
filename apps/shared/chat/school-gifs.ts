/** Fixed online reaction collection. Source pages retain attribution; no generated media or provider search. */
export const SCHOOL_GIFS = [
  {
    category: "Ideas",
    label: "SpongeBob imagination",
    sourceUrl:
      "https://tenor.com/view/spongebob-rainbow-imagination-gif-11624341",
    url: "https://c.tenor.com/lzbdb_9VJM0AAAAC/tenor.gif",
    poster: "https://media.tenor.com/lzbdb_9VJM0AAAAe/spongebob-rainbow.png",
    keywords: ["rainbow", "creative", "idea", "spongebob"],
    id: "spongebob-imagination",
  },
  {
    category: "Busy",
    label: "Typing cat",
    sourceUrl: "https://tenor.com/view/cat-typing-fast-typing-gif-7867869",
    url: "https://c.tenor.com/tOoW-TVnlhUAAAAC/tenor.gif",
    poster: "https://media.tenor.com/tOoW-TVnlhUAAAAe/cat-typing.png",
    keywords: ["cat", "typing", "homework", "study", "working", "speed"],
    id: "cat-typing",
  },
  {
    category: "Same",
    label: "Spider-Man pointing",
    sourceUrl: "https://tenor.com/view/spider-man-pointing-gif-14917655",
    url: "https://c.tenor.com/Q_6JIVo5V3kAAAAC/tenor.gif",
    poster: "https://media.tenor.com/Q_6JIVo5V3kAAAAe/spider-man-pointing.png",
    keywords: ["spiderman", "same", "you", "me", "twins", "relatable"],
    id: "spiderman-pointing",
  },
  {
    category: "Awkward",
    label: "Homer disappearing",
    sourceUrl: "https://tenor.com/view/homer-simpson-bush-hiding-gif-9157188",
    url: "https://c.tenor.com/PLUTuUODwwkAAAAC/tenor.gif",
    poster: "https://media.tenor.com/PLUTuUODwwkAAAAe/homer-simpson-bush.png",
    keywords: [
      "homer",
      "simpsons",
      "bushes",
      "hide",
      "awkward",
      "oops",
      "leave",
    ],
    id: "homer-bushes",
  },
  {
    category: "Surprised",
    label: "Surprised Pikachu",
    sourceUrl:
      "https://tenor.com/view/surprised-pikachu-surprised-pikachu-face-face-gif-15329743",
    url: "https://c.tenor.com/ZhKMg4_yCTgAAAAC/tenor.gif",
    poster: "https://media.tenor.com/ZhKMg4_yCTgAAAAe/surprised-pikachu.png",
    keywords: ["pikachu", "pokemon", "shock", "wow", "surprise"],
    id: "pikachu-surprised",
  },
  {
    category: "Busy",
    label: "Kermit typing",
    sourceUrl:
      "https://tenor.com/view/kermit-typing-essay-school-smart-gif-4851885",
    url: "https://c.tenor.com/XgaU95K_XiwAAAAC/tenor.gif",
    poster: "https://media.tenor.com/XgaU95K_XiwAAAAe/kermit-typing.png",
    keywords: ["kermit", "typing", "essay", "homework", "study", "deadline"],
    id: "kermit-typing",
  },
  {
    category: "Really?",
    label: "Jim looking at the camera",
    sourceUrl:
      "https://tenor.com/view/jim-halpert-john-krasinski-the-office-touche-gif-4904198",
    url: "https://c.tenor.com/tVA09juo9zgAAAAC/tenor.gif",
    poster:
      "https://media.tenor.com/tVA09juo9zgAAAAe/jim-halpert-john-krasinski.png",
    keywords: ["jim", "office", "really", "seriously", "awkward", "look"],
    id: "jim-camera",
  },
  {
    category: "Celebrate",
    label: "Leonardo applauding",
    sourceUrl:
      "https://tenor.com/view/applause-leonardo-dicaprio-clap-gif-9602869",
    url: "https://c.tenor.com/029LgfMnsisAAAAC/tenor.gif",
    poster:
      "https://media.tenor.com/029LgfMnsisAAAAe/applause-leonardo-dicaprio.png",
    keywords: [
      "leonardo",
      "clap",
      "applause",
      "good job",
      "congrats",
      "celebrate",
      "respect",
    ],
    id: "leonardo-applause",
  },
  {
    category: "Celebrate",
    label: "Pedro raccoon",
    sourceUrl: "https://tenor.com/view/pedro-raccoon-gif-2948698194229138425",
    url: "https://c.tenor.com/KOvhYoDdE_kAAAAC/tenor.gif",
    poster: "https://media.tenor.com/KOvhYoDdE_kAAAAe/pedro-raccoon.png",
    keywords: ["pedro", "raccoon", "dance", "party", "celebrate", "happy"],
    id: "pedro-raccoon",
  },
];
export type SchoolGif = (typeof SCHOOL_GIFS)[number];

export function searchSchoolGifs(query: string) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return SCHOOL_GIFS.filter((gif) => {
    const text =
      `${gif.label} ${gif.category} ${gif.keywords.join(" ")}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
}
