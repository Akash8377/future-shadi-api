// utils/datetimeUtils.js

const formatDateTime = (date) => {
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

module.exports = { formatDateTime };
