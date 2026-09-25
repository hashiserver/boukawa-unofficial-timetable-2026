import('./app.js').catch(error => {
  console.error(error);
  const area = document.querySelector('#timeline-body');
  area.classList.add('load-error');
  area.textContent = 'タイムテーブルを読み込めませんでした。通信状態を確認して再読み込みしてください。';
  const retry = document.createElement('button');
  retry.textContent = '再読み込み';
  retry.addEventListener('click', () => location.reload());
  area.append(retry);
});
