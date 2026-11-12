// Descobre quais países uma manchete cita: pelo nome, por outros nomes, gentílicos e algumas capitais.
// Tudo sem acento. Nome com maiúscula precisa estar com maiúscula no título ("Peru" o país, não "peru" a ave);
// gentílicos e apelidos em minúscula valem de qualquer jeito ("russos", "Russos").
const PAISES = require('./paises.json');

const semAcento = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
const POUCO = new Set(['de', 'do', 'da', 'dos', 'das', 'e']);
const bonito = n => n.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase()).split(' ').map(w => POUCO.has(w.toLowerCase()) ? w.toLowerCase() : w).join(' ');

// outros nomes (com maiúscula = só com maiúscula) e gentílicos/capitais (minúscula = tanto faz)
const EXTRA = {
  US: ['EUA', 'Casa Branca', 'Pentagono', 'Washington', 'norte-american[oa]s?', 'estadunidenses?'],
  GB: ['Inglaterra', 'Londres', 'britanic[oa]s?'],
  CN: ['Pequim', 'chines', 'chinesa', 'chineses', 'chinesas'],
  RU: ['Moscou', 'Kremlin', 'russ[oa]s?'],
  UA: ['Kiev', 'Kyiv', 'ucranian[oa]s?'],
  IL: ['Tel Aviv', 'israelenses?'],
  PS: ['Gaza', 'Cisjordania', 'Hamas', 'palestin[oa]s?'],
  IR: ['Teera', 'Irao', 'Ormuz', 'iranian[oa]s?'],          // "Irão": o tradutor às vezes escreve em português de Portugal
  IQ: ['Bagda', 'iraquian[oa]s?'],
  SY: ['Damasco'],
  LB: ['Beirute', 'Hezbollah'],
  YE: ['houthis?', 'iemenitas?'],
  SA: ['Riad', 'Riade', 'sauditas?'],
  AE: ['Emirados Arabes Unidos', 'Dubai', 'Abu Dhabi'],
  QA: ['Qatar', 'Doha'],
  KW: ['Kuait'],
  TR: ['Ancara', 'Istambul', 'turc[oa]s?'],
  DE: ['Berlim', 'alemao', 'alema', 'alemaes', 'alemas'],
  FR: ['Paris', 'frances', 'francesa', 'franceses', 'francesas'],
  IT: ['italian[oa]s?'],
  ES: ['Madri'],
  PT: ['Lisboa'],
  NL: ['Paises Baixos', 'holandes', 'holandesa', 'holandeses'],
  BE: ['Bruxelas', 'belgas?'],
  CH: ['suic[oa]s?'],
  PL: ['Varsovia', 'polones', 'polonesa', 'poloneses'],
  SE: ['suec[oa]s?'], NO: ['noruegues', 'norueguesa'], FI: ['finlandes', 'finlandesa'], DK: ['dinamarques', 'dinamarquesa'],
  GR: ['Atenas'], HU: ['hungar[oa]s?'], RS: ['servi[oa]s?'], BY: ['Belarus', 'bielorruss[oa]s?'],
  CZ: ['Republica Tcheca', 'tchec[oa]s?'], BA: ['Bosnia e Herzegovina'],
  JP: ['Toquio', 'japones', 'japonesa', 'japoneses'],
  KR: ['Seul', 'sul-corean[oa]s?'],
  KP: ['Pyongyang', 'norte-corean[oa]s?'],
  TW: ['Taipe', 'taiwanes', 'taiwanesa', 'taiwaneses'],
  IN: ['Nova Delhi', 'indian[oa]s?'],
  PK: ['Islamabad', 'paquistanes', 'paquistanesa', 'paquistaneses'],
  AF: ['Cabul', 'Taliba', 'afegao', 'afega', 'afegaos'],
  VN: ['Vietname', 'vietnamitas?'], TH: ['tailandes', 'tailandesa'], PH: ['filipin[oa]s?'], ID: ['indonesi[oa]s?'],
  MM: ['Myanmar'], AU: ['australian[oa]s?'], NZ: ['neozelandes', 'neozelandesa'],
  CA: ['Ottawa', 'canadenses?'], MX: ['mexican[oa]s?'],
  AR: ['Buenos Aires', 'argentin[oa]s?'], VE: ['Caracas', 'venezuelan[oa]s?'], CO: ['Bogota', 'colombian[oa]s?'],
  CL: ['Santiago do Chile', 'chilen[oa]s?'], PE: ['peruan[oa]s?'], BO: ['bolivian[oa]s?'], PY: ['paraguai[oa]s?'],
  UY: ['Montevideu', 'uruguai[oa]s?'], EC: ['equatorian[oa]s?'], CU: ['Havana', 'cuban[oa]s?'], HT: ['haitian[oa]s?'],
  PA: ['panamenh[oa]s?'], BR: ['Brasilia'],
  EG: ['Cairo', 'egipci[oa]s?'], ZA: ['sul-african[oa]s?'], NG: ['nigerian[oa]s?'], ET: ['etiopes?'], KE: ['quenian[oa]s?'],
  MA: ['marroquin[oa]s?'], DZ: ['argelin[oa]s?'], LY: ['libi[oa]s?'], SD: ['sudanes', 'sudanesa', 'sudaneses'],
  CD: ['Republica Democratica do Congo'], BF: ['Burkina Faso'], SZ: ['Suazilandia'], BJ: ['Benim'],
  FK: ['Malvinas'], GL: ['groenlandes', 'groenlandesa'],
};
// nomes do mapa que saem diferentes no texto
const NOME_TEXTO = { DO: 'Republica Dominicana', CF: 'Republica Centro-Africana', CD: 'RD Congo' };

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const REGRAS = [];
for (const [cod, nome] of Object.entries(PAISES)) {
  const principal = NOME_TEXTO[cod] || semAcento(bonito(nome));
  REGRAS.push({ cod, txt: principal, re: new RegExp(`(?<![\\p{L}\\d])${esc(principal)}(?![\\p{L}\\d])`, 'gu') });
}
for (const [cod, lista] of Object.entries(EXTRA)) {
  if (!PAISES[cod]) continue;
  for (const a of lista) {
    const maiuscula = /^\p{Lu}/u.test(a), padrao = maiuscula ? esc(a) : a;     // os em minúscula já são padrões
    REGRAS.push({ cod, txt: a, re: new RegExp(`(?<![\\p{L}\\d])${padrao}(?![\\p{L}\\d])`, maiuscula ? 'gu' : 'giu') });
  }
}
// os nomes mais compridos primeiro: "Guiné-Bissau" antes de "Guiné", "Sudão do Sul" antes de "Sudão"
REGRAS.sort((a, b) => b.txt.length - a.txt.length);

// conjunto de códigos dos países citados no texto, na ordem em que aparecem ("Irã executa... Israel" → IR antes de IL)
function paisesNoTexto(texto) {
  let s = semAcento(texto); const pos = new Map();
  for (const { cod, re } of REGRAS) {
    re.lastIndex = 0;
    const m = re.exec(s);
    if (!m) continue;
    pos.set(cod, Math.min(pos.has(cod) ? pos.get(cod) : Infinity, m.index));
    re.lastIndex = 0; s = s.replace(re, x => ' '.repeat(x.length));     // apaga o trecho para um nome menor não pegar de novo
  }
  return new Set([...pos.keys()].sort((a, b) => pos.get(a) - pos.get(b)));
}

// o que não é notícia do mundo: esporte, novela, prova, loteria, celebridade, promoção.
// Cuidado com palavras de duplo sentido ("rodada de negociações", "jogo político"): só entram as formas esportivas.
const FORA = /\b(campeonato|rodada \d+|\d+a rodada|serie [abc]|futebol|brasileirao|libertadores|sul-americana|copa do mundo|copa do brasil|copa america|champions league|premier league|la liga|gols?|placar|escalac\w*|tecnico de futebol|assista|onde assistir|transmissao ao vivo|sub-\d+|enem|vestibular|concurso publico|novelas?|capitulos?|bbb|big brother|reality|horoscopo|loteria|mega-sena|quina|lotofacil|receita de|promoc\w*|cupom|black friday|nba|nfl|ufc|formula 1|f1|gp|grande premio|motogp|tenista|olimpiad\w*|celebridades?|famosos)\b|\S x \S/i;
const ehFora = texto => FORA.test(semAcento(texto));

module.exports = { paisesNoTexto, semAcento, ehFora };
