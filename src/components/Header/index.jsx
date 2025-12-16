import "./style.css";

function Header() {
  return (
    // 1. Use <header> as the main container
    <header className="flex items-center  p-4 bg-PrimaryDark  ">
      {/* Logo/Branding Link */}
      <div className=" font-black  w-80 flex justify-center flex-shrink-0 text-white">
        <a href="/">-</a>
      </div>

      <div className="">
        <input
          className="bg-white rounded-md text-gray-500 p-1 pl-5"
          type="text"
          placeholder="Pesquisar"
        />
      </div>

      {/* 2. Use <nav> for navigation links */}
      <nav className="flex gap-8 ml-auto text-white">
        <a href="/">Mapa</a>
        <a href="/about">Comunidade</a>
      </nav>

      {/* 3. Use an <a> tag styled as a button for navigation */}
      <a href="/signup" className="ml-20 text-white">
        Login
      </a>
    </header>
  );
}
export default Header;
