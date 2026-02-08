(function () {
  var status = document.getElementById('leaderboard-status');
  var table = document.getElementById('leaderboard-table');
  var tbody = table.querySelector('tbody');
  var empty = document.getElementById('leaderboard-empty');

  fetch('/api/leaderboard')
    .then(function (r) {
      if (!r.ok) throw new Error(r.statusText);
      return r.json();
    })
    .then(function (data) {
      status.textContent = '';
      if (!data.entries || data.entries.length === 0) {
        empty.hidden = false;
        return;
      }
      table.hidden = false;
      data.entries.forEach(function (row, i) {
        var tr = document.createElement('tr');
        tr.innerHTML =
          '<td>' + (i + 1) + '</td>' +
          '<td>' + escapeHtml(row.username || row.player || '-') + '</td>' +
          '<td>' + (row.level != null ? row.level : '-') + '</td>' +
          '<td>' + (row.experience != null ? row.experience : '-') + '</td>' +
          '<td>' + (row.hayEaten != null ? row.hayEaten : '-') + '</td>';
        tbody.appendChild(tr);
      });
    })
    .catch(function () {
      status.textContent = 'Could not load leaderboard.';
    });

  function escapeHtml(s) {
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }
})();
