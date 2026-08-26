fetch('http://localhost:3000/api/probe?url=' + encodeURIComponent('https://ajn.archives.pub/hourly-m4v/20260814_Fri_WarRoom-Hr3.m4v'))
  .then(res => res.json().then(j => console.log(res.status, j)))
  .catch(console.error);
