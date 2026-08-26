import { sanitizeTitle } from './src/lib/title-sanitizer';

const tests = [
  {
    input: "https://archive.org/download/21movies/Ginger%20In%20The%20Morning%201974.mp4",
    expected: "Ginger In The Morning 1974"
  },
  {
    input: "https://archive.org/download/21movies/Legacy%20of%20Blood%20l%20Horror%20%281971%29.mp4",
    expected: "Legacy of Blood l Horror 1971"
  },
  {
    input: "https://archive.org/download/21movies/The%20Borrowers%20%201973%20%20Movie.mp4",
    expected: "The Borrowers 1973"
  },
  {
    input: "https://archive.org/download/21movies/The%20Cat%20O%27%20Nine%20Tails%201971%29.mp4",
    expected: "The Cat O' Nine Tails 1971"
  },
  {
    input: "Канал 1",
    expected: "Unknown Title"
  }
];

let allPassed = true;

tests.forEach((test, index) => {
  const result = sanitizeTitle(test.input);
  if (result === test.expected) {
    console.log(`✅ Test ${index + 1} passed: "${test.input}" -> "${result}"`);
  } else {
    console.error(`❌ Test ${index + 1} failed:`);
    console.error(`   Input:    "${test.input}"`);
    console.error(`   Expected: "${test.expected}"`);
    console.error(`   Got:      "${result}"`);
    allPassed = false;
  }
});

if (allPassed) {
  console.log("\\nAll tests passed successfully!");
} else {
  console.error("\\nSome tests failed.");
  process.exit(1);
}
