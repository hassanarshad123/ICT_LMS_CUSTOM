import 'package:flutter/material.dart';

class AppShadows {
  AppShadows._();

  static const List<BoxShadow> none = [];

  // Subtle card shadow
  static const List<BoxShadow> sm = [
    BoxShadow(
      color: Color(0x0D000000), // 5% black
      blurRadius: 8,
      offset: Offset(0, 2),
    ),
  ];

  // Medium elevation (modals, dropdowns)
  static const List<BoxShadow> md = [
    BoxShadow(
      color: Color(0x14000000), // 8% black
      blurRadius: 16,
      offset: Offset(0, 4),
    ),
  ];

  // High elevation (floating elements)
  static const List<BoxShadow> lg = [
    BoxShadow(
      color: Color(0x1F000000), // 12% black
      blurRadius: 24,
      offset: Offset(0, 8),
    ),
  ];

  // Bottom nav bar shadow
  static const List<BoxShadow> nav = [
    BoxShadow(
      color: Color(0x14000000),
      blurRadius: 20,
      offset: Offset(0, -4),
    ),
  ];
}
