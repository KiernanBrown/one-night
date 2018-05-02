const mainPage = (req, res) => {
  res.render('app');
};

const helpPage = (req, res) => {
  res.render('help');
};

const premiumPage = (req, res) => {
  res.render('premium');
};

const router = (app) => {
  app.get('/main', mainPage);
  app.get('/help', helpPage);
  app.get('/premium', premiumPage);
  app.get('/', mainPage);
  app.get('/*', mainPage);
};

module.exports = router;
