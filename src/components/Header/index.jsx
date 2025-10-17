import "./style.css";
import SearchBar from "../SearchBar";

function Header() {
  return (
    // 1. Use <header> as the main container
    <header className="flex items-center  p-4 bg-PrimaryDark text-white "> 
      
      {/* Logo/Branding Link */}
      <div className=" font-black  w-80 flex justify-center flex-shrink-0 ">
        <a  href="/">Kubus</a> 
      </div>

      <div className="">
        <SearchBar/>
      </div>

      {/* 2. Use <nav> for navigation links */}
      <nav className="flex gap-8 ml-auto"> 
        <a href="/">Mapa</a>
        <a href="/about">Comunidade</a>
      </nav>

      {/* 3. Use an <a> tag styled as a button for navigation */}
      <a  href="/signup" className="ml-20"> 
        Login
      </a>

    </header>
  );
}
export default Header;