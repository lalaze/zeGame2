(async () => {
  const art = await import('/src/render/cozy-cat-assets.ts');
  const fine = await import('/src/render/fine-sprite-art.ts');
  const sprites = await import('/src/render/sprites.ts');
  const { CATS } = await import('/src/game/pets.ts');
  const registry = await import('/src/render/generated-main-art.ts');
  const { PetPanel } = await import('/src/ui/pets.ts');
  const { createInitialState } = await import('/src/game/state.ts');
  art.clearCozyCats();
  await art.preloadCozyCats();
  const adapter = art.createCozyCatArt();
  registry.setGeneratedCatAdapter(adapter);
  const states = ['idle', 'swish', 'blink', 'happy', 'walkA', 'walkB', 'sleep', 'groomA', 'groomB', 'stretch', 'watch', 'lookUp', 'nuzzleA', 'nuzzleB'];
  const sheet = document.createElement('canvas'); sheet.width = 1440; sheet.height = 1270;
  const ctx = sheet.getContext('2d'); ctx.fillStyle = '#efe1c4'; ctx.fillRect(0, 0, sheet.width, sheet.height); ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#573a27'; ctx.font = '15px sans-serif'; ctx.fillText('Cozy cats v2 — 12 breeds, all 14 authored poses at 4× world size', 20, 24);
  states.forEach((name, i) => ctx.fillText(name, 100 + i * 94, 50));
  const failures = [], hashes = [], contactErrors = [];
  let checked = 0;
  CATS.forEach((cat, row) => {
    const resolved = adapter.resolve(cat.id, sprites.catFrames(cat.id));
    const f = resolved.frames;
    const frames = [f.idle, f.swish, f.blink, f.happy, ...f.walk, f.sleep, ...f.groom, f.stretch, f.watch, f.lookUp, ...f.nuzzle];
    ctx.fillStyle = '#573a27'; ctx.fillText(cat.id, 8, 105 + row * 100);
    if (!resolved.generated || adapter.resolve(cat.id, sprites.catFrames(cat.id)).frames !== f) failures.push(cat.id + ': unstable resolver');
    const values = [];
    frames.forEach((frame, column) => {
      const backing = fine.fineSpriteArt(frame).canvas, source = backing.getContext('2d');
      const { data } = source.getImageData(0, 0, backing.width, backing.height);
      let ink = 0, edge = 0, hash = 2166136261;
      for (let n = 0; n < data.length; n++) hash = Math.imul(hash ^ data[n], 16777619);
      for (let p = 0; p < backing.width * backing.height; p++) if (data[p * 4 + 3] > 100) {
        ink++; const x = p % backing.width, y = Math.floor(p / backing.width);
        if (!x || !y || x === backing.width - 1 || y === backing.height - 1) edge++;
      }
      if (!ink || edge) failures.push(cat.id + ':' + states[column] + ': empty/clipped ' + ink + '/' + edge);
      const contact = adapter.contactPoints(frame), mirrored = adapter.contactPoints(frame, true), offset = adapter.drawOffset(frame);
      if (!contact || !mirrored || contact.foot.x !== 12 || contact.foot.y !== 17 || offset.x !== -3 ||
          Math.abs(contact.headContact.x + mirrored.headContact.x - 24) > .001 || mirrored.headContact.y !== contact.headContact.y)
        failures.push(cat.id + ':' + states[column] + ': invalid contacts');
      const x = Math.min(backing.width - 1, Math.round(contact.headContact.x * 4)), y = Math.min(backing.height - 1, Math.round(contact.headContact.y * 4));
      if (data[(y * backing.width + x) * 4 + 3] <= 100) contactErrors.push(cat.id + ':' + states[column]);
      ctx.drawImage(backing, 94 + column * 94, 70 + row * 100, 96, 72);
      values.push(hash >>> 0); checked++;
    });
    if (values[4] === values[5] || values[12] === values[13]) failures.push(cat.id + ': repeated animation frames');
    hashes.push({ breed: cat.id, hashes: values });
  });
  const root = document.createElement('div');
  const panel = new PetPanel(root, createInitialState(Date.now()), () => {}); panel.update();
  const portraits = [...root.querySelectorAll('.pet-choice img')];
  if (portraits.length !== 12 || portraits.some(image => !image.src.startsWith('data:image/png'))) failures.push('Missing shared UI portraits');
  const report = { checked, breeds: adapter.readyBreeds, failures, contactErrors, sharedPortraits: portraits.length, hashes };
  window.cozyCatReport = report;
  document.body.replaceChildren(sheet);
  document.documentElement.style.cssText = 'height:auto;min-height:1270px;overflow:visible;background:#efe1c4';
  document.body.style.cssText = 'margin:0;width:1440px;min-width:1440px;height:auto;min-height:1270px;display:block;overflow:visible;background:#efe1c4';
  sheet.style.cssText = 'width:1440px;height:1270px;max-width:none;max-height:none;display:block;position:static';
  document.title = 'Cozy cat artwork validation';
  return report;
})()
