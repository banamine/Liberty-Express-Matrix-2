(async () => {
  const res = await fetch('https://archive.org/metadata/ALF-The-Complete-Series');
  const data = await res.json();
  const thumbs = data.files.filter(f => f.format === 'Thumbnail' || f.name.includes('.thumbs'));
  console.log('Thumbnails found:', thumbs.length);
  if (thumbs.length > 0) {
    console.log(thumbs[0]);
  }
})();
