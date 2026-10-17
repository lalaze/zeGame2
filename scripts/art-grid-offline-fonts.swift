// Offline QA only: CoreText scratch rasters for the JS sign-mask painter.
// Runtime remains Canvas/Phaser; this lets macOS inspect native font bounds offline.
import Foundation
import CoreText
import CoreGraphics
let url=URL(fileURLWithPath:CommandLine.arguments[1])
let descriptors=CTFontManagerCreateFontDescriptorsFromURL(url as CFURL) as! [CTFontDescriptor]
let pixel=CTFontCreateWithFontDescriptor(descriptors[0],12,nil)
let platform=CTFontCreateWithName("PingFangSC-Regular" as CFString,12,nil)
var result:[String:String]=[:]
for ch in Set(Array("猫与朋友咖啡馆营业中休息中今日菜单点取餐龘𠮷🐱" + (CommandLine.arguments.count > 2 ? CommandLine.arguments[2] : "")).map(String.init)) {
  for (name,font) in [("pixel",pixel),("platform",platform)] {
    let ctx=CGContext(data:nil,width:24,height:32,bitsPerComponent:8,bytesPerRow:96,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue)!
    ctx.textPosition=CGPoint(x:4,y:12)
    let attrs=[kCTFontAttributeName:font,kCTForegroundColorAttributeName:CGColor(red:1,green:1,blue:1,alpha:1)] as CFDictionary
    let line=CTLineCreateWithAttributedString(CFAttributedStringCreate(nil,ch as CFString,attrs))
    CTLineDraw(line,ctx)
    result[name+":"+ch]=Data(bytes:ctx.data!,count:24*32*4).base64EncodedString()
  }
}
FileHandle.standardOutput.write(try JSONSerialization.data(withJSONObject:result,options:[.sortedKeys]))
