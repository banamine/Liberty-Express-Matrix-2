const req = await fetch('https://archive.org/metadata/ALFTheCompleteSeries');
const res = await req.json();
console.log(res.metadata ? res.metadata.title : null);
console.log(res.files ? res.files.slice(0, 5).map(f => f.name) : null);
