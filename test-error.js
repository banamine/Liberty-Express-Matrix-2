const data = {
  files: [
    { name: "test", format: ["Captions"] }
  ]
};
const videoFiles = data.files.filter((f) => 
  f.name && f.format && (
    f.format.toLowerCase().includes('h.264')
  )
);
