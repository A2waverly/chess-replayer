var engine; // global, accessible depuis la console

$(document).ready(function () {

  // ============================
  // INITIALISATION
  // ============================
  var game = new Chess();
  var mode = "free"; // "free" | "analysis"
  var history = [];
  var moveIndex = 0;

  var board = Chessboard('board', {
    position: game.fen(),
    pieceTheme: 'img/chesspieces/wikipedia/{piece}.png',
    draggable: true,

    onDrop: function (source, target) {
      if (mode === "analysis") return 'snapback';

      var move = game.move({ from: source, to: target, promotion: 'q' });
      if (!move) return 'snapback';

      history = game.history();
      moveIndex = history.length;

      board.position(game.fen());
      updateCurrentPlayer();
      updateMoveList();
      updateCurrentMoveDisplay();

      analyzePositionSafe(); // ✅ safe
    },

    onSnapEnd: function () {
      board.position(game.fen());
    }
  });

  // ============================
  // JOUEUR ACTIF
  // ============================
  function updateCurrentPlayer() {
    var whiteToMove = (game.turn() === 'w');
    $('#currentPlayer')
      .text(whiteToMove ? "Blanc" : "Noir")
      .css({
        color: whiteToMove ? "white" : "black",
        backgroundColor: whiteToMove ? "black" : "white"
      });
  }

  // ============================
  // LISTE DES COUPS
  // ============================
  function updateMoveList() {
    $('#moveList').empty();
    for (var i = 0; i < moveIndex; i++) {
      $('#moveList').append($('<li>').text(history[i]));
    }
    var container = $('#moveListContainer');
    container.scrollTop(container[0].scrollHeight);
  }

  function updateCurrentMoveDisplay() {
    $('#currentMove').text(history[moveIndex] || '');
  }

  updateCurrentPlayer();

  // ============================
  // CHARGER PGN
  // ============================
  $('#loadPGN').on('click', function () {
    var pgn = $('#pgnInput').val().trim();
    if (!pgn) return;

    var tempGame = new Chess();
    if (!tempGame.load_pgn(pgn)) {
      showNotification("❌ PGN invalide", "error");
      return;
    }

    mode = "analysis";
    history = tempGame.history();
    moveIndex = 0;

    game.reset();
    board.position(game.fen());

    updateCurrentPlayer();
    updateMoveList();
    updateCurrentMoveDisplay();

    analyzePositionSafe();
    showNotification("✅ Partie chargée");
  });

  // ============================
  // NAVIGATION COUPS
  // ============================
  $('#nextMove').on('click', function () {
    if (moveIndex >= history.length) return;

    game.move(history[moveIndex]);
    moveIndex++;

    board.position(game.fen());
    updateCurrentPlayer();
    updateMoveList();
    updateCurrentMoveDisplay();

    analyzePositionSafe();
  });

  $('#prevMove').on('click', function () {
    if (moveIndex === 0) return;

    game.undo();
    moveIndex--;

    board.position(game.fen());
    updateCurrentPlayer();
    updateMoveList();
    updateCurrentMoveDisplay();

    analyzePositionSafe();
  });

  // ============================
  // CLAVIER
  // ============================
  $(document).keydown(function (e) {
    if (e.key === "ArrowRight") $('#nextMove').click();
    if (e.key === "ArrowLeft") $('#prevMove').click();
  });

  // ============================
  // FLIP BOARD
  // ============================
  $('#flipBoard').on('click', function () {
    var o = board.orientation();
    var n = (o === 'white') ? 'black' : 'white';
    board.orientation(n);
    flipEvalBar(n === 'black');
  });

  // ============================
  // RESET
  // ============================
  $('#resetBoard').on('click', function () {
    if (engine) engine.postMessage('stop');
    game.reset();
    history = [];
    moveIndex = 0;
    mode = "free";

    board.position(game.fen());
    $('#pgnInput').val('');

    updateCurrentPlayer();
    updateMoveList();
    updateCurrentMoveDisplay();
    updateEvalBar(0);

    analyzePositionSafe();
    showNotification("🔄 Échiquier réinitialisé");
  });

  // ============================
  // NOTIFICATIONS
  // ============================
  function showNotification(message, type = "success") {
    var n = $('#notification');
    n.text(message)
      .removeClass()
      .addClass(type === "success" ? "notification-success" : "notification-error")
      .css('opacity', 1);
    setTimeout(() => n.css('opacity', 0), 3000);
  }

  // ============================
  // BARRE D'ÉVALUATION
  // ============================
  function updateEvalBar(v) {
    v = Math.max(-10, Math.min(10, v));
    var p = (v + 10) * 5;
    $('#evalBar').css({ height: p + '%' });
  }

  function flipEvalBar(isBlack) {
    $('#evalBarContainer').css('transform', isBlack ? 'rotate(180deg)' : 'rotate(0deg)');
  }

  updateEvalBar(0);

  // ============================
  // STOCKFISH
  // ============================
  engine = new Worker('js/stockfish.js');
  engine.postMessage('uci');

  // ============================
  // ANALYSE SAFE
  // ============================
  var analyzeTimeout;
  function analyzePositionSafe() {
    if (!engine) return;
    engine.postMessage('stop'); // stop toute analyse en cours

    if (analyzeTimeout) clearTimeout(analyzeTimeout);
    analyzeTimeout = setTimeout(function () {
      engine.postMessage('position fen ' + game.fen());
      engine.postMessage('go depth 12');
    }, 50); // petit délai pour que Stockfish soit prêt
  }

  engine.onmessage = function (event) {
    var line = event.data;

    if (line.includes('score cp')) {
      var m = line.match(/score cp (-?\d+)/);
      if (!m) return;
      var evalValue = parseInt(m[1], 10) / 100;

      // inverser si noirs au trait
      if (game.turn() === 'b') evalValue = -evalValue;

      updateEvalBar(evalValue);
    }

    if (line.includes('score mate')) {
      var whiteWins = !line.includes('score mate -');
      if (game.turn() === 'b') whiteWins = !whiteWins;
      updateEvalBar(whiteWins ? 10 : -10);
    }
  };

});
