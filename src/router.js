const mainPage = (req, res) => {
  res.render('app');
};

const helpPage = (req, res) => {
  res.render('help');
};

const changelogPage = (req, res) => {
  res.render('changelog');
};

const router = (app) => {
  app.get('/main', mainPage);
  app.get('/help', helpPage);
  app.get('/changelog', changelogPage);
  app.get('/', mainPage);
  app.get('/*', mainPage);
};

module.exports = router;
