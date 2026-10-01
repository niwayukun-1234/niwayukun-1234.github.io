/* 閲覧ログの保存先（Supabase）。url と key が空のあいだはログを送らない。
   key には Supabase の「publishable（公開用）キー」を入れる。秘密鍵（service_role / secret）は絶対に入れない。 */
window.PF_LOG = {
  url: "",
  key: ""
};
