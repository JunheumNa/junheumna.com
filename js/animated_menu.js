$(function() {
  $('.nav-menu-wrapper').on('click.mobileNav', function(){
    $('.nav-menu-wrapper .nav-menu').toggleClass('menu-trigger-open');
    $('.menu-items').slideToggle(400); // Toggle visibility of menu items with slide animation
  });
});
