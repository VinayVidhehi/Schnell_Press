const currentTimestamp = Date.now();
const expiryTimestamp = 1721455668737;
const timeLeft = expiryTimestamp - currentTimestamp;

const daysLeft = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
const hoursLeft = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
const secondsLeft = Math.floor((timeLeft % (1000 * 60)) / 1000);

console.log(`Time left: ${daysLeft} days, ${hoursLeft} hours, ${minutesLeft} minutes, ${secondsLeft} seconds`);
