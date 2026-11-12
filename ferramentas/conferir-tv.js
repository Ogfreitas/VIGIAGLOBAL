// Confere agora quais emissoras da TV ao vivo (motor/tv.js) estão no ar e deixam tocar dentro do Vigia.
// Uso: node ferramentas/conferir-tv.js   (não precisa do motor ligado; só lê as páginas do YouTube)
const tv = require('../motor/tv');
(async () => {
  const canais = tv.lista().paises.flatMap(x => x.canais.map(c => ({ ...c, p: x.p })));
  console.log(`\nconferindo ${canais.length} emissoras…\n`);
  let i = 0, ok = 0;
  const fila = async () => {
    while (i < canais.length) {
      const c = canais[i++], d = await tv.aoVivo(c.id);
      const bom = d.aoVivo && d.embed !== false; if (bom) ok++;
      console.log(`${bom ? 'OK ' : '-- '} ${c.p} ${c.nome.padEnd(30)} ${d.aoVivo ? 'AO VIVO' : 'fora   '} ${d.embed === false ? 'NÃO toca fora do YouTube' : ''} ${d.vendo ? d.vendo + ' assistindo' : ''} ${d.aoVivo ? '' : d.motivo}`);
    }
  };
  await Promise.all([fila(), fila(), fila(), fila()]);
  console.log(`\n${ok} de ${canais.length} no ar agora e tocando dentro do Vigia.`);
})();
