const id = process.argv[2];
fetch(`https://archive.org/metadata/${id}`)
  .then(res => res.json())
  .then(data => {
    const formats = data.files.map(f => f.format);
    console.log(formats.filter((v, i, a) => a.indexOf(v) === i));
  });
