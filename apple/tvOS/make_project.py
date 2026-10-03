from pathlib import Path
p=Path(__file__).resolve().parent
files=['App.swift','CanvasView.swift','Audio.swift','Fonts.swift','Resources/game.js','Resources/host.js','Resources/dom.json','Resources/BagelFatOne-400.ttf','Resources/Figtree-500.ttf','Resources/Figtree-700.ttf','Assets.xcassets']
obj={};idx=1
def add(s):
 global idx
 k=f'{idx:024X}';idx+=1;obj[k]=s;return k
refs=[];sources=[];resources=[]
for f in files:
 r=add('{isa = PBXFileReference; path = "'+f+'"; sourceTree = "<group>"; }');refs.append(r)
 b=add('{isa = PBXBuildFile; fileRef = '+r+'; }');(sources if f.endswith('.swift') else resources).append(b)
product=add('{isa = PBXFileReference; explicitFileType = wrapper.application; path = Beanbound.app; sourceTree = BUILT_PRODUCTS_DIR; }')
group=add('{isa = PBXGroup; path = Beanbound; sourceTree = "<group>"; children = ('+','.join(refs)+'); }')
products=add('{isa = PBXGroup; name = Products; sourceTree = "<group>"; children = ('+product+'); }')
main=add('{isa = PBXGroup; sourceTree = "<group>"; children = ('+group+','+products+'); }')
src=add('{isa = PBXSourcesBuildPhase; buildActionMask = 2147483647; files = ('+','.join(sources)+'); runOnlyForDeploymentPostprocessing = 0; }')
res=add('{isa = PBXResourcesBuildPhase; buildActionMask = 2147483647; files = ('+','.join(resources)+'); runOnlyForDeploymentPostprocessing = 0; }')
fw=add('{isa = PBXFrameworksBuildPhase; buildActionMask = 2147483647; files = (); runOnlyForDeploymentPostprocessing = 0; }')
def configs(settings):
 cs=[]
 for name in ['Debug','Release']:
  cs.append(add('{isa = XCBuildConfiguration; name = '+name+'; buildSettings = {'+settings+('SWIFT_OPTIMIZATION_LEVEL = "-Onone";' if name=='Debug' else 'SWIFT_OPTIMIZATION_LEVEL = "-O";')+'}; }'))
 return add('{isa = XCConfigurationList; buildConfigurations = ('+','.join(cs)+'); defaultConfigurationIsVisible = 0; defaultConfigurationName = Release; }')
pc=configs('SDKROOT = appletvos; TVOS_DEPLOYMENT_TARGET = 17.0; SWIFT_VERSION = 5.0; CLANG_ENABLE_MODULES = YES;')
tc=configs('PRODUCT_BUNDLE_IDENTIFIER = com.vcgames.beanbound.tv; PRODUCT_NAME = Beanbound; TARGETED_DEVICE_FAMILY = 3; GENERATE_INFOPLIST_FILE = YES; INFOPLIST_KEY_CFBundleDisplayName = Beanbound; INFOPLIST_KEY_UILaunchScreen_Generation = YES; CURRENT_PROJECT_VERSION = 3; MARKETING_VERSION = 1.0.7; ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon; CODE_SIGN_STYLE = Automatic; DEVELOPMENT_TEAM = P4ZB4J2Z8M; SUPPORTED_PLATFORMS = "appletvos appletvsimulator";')
target=add('{isa = PBXNativeTarget; name = Beanbound; productName = Beanbound; productType = "com.apple.product-type.application"; productReference = '+product+'; buildConfigurationList = '+tc+'; buildPhases = ('+src+','+fw+','+res+'); buildRules = (); dependencies = (); }')
project=add('{isa = PBXProject; buildConfigurationList = '+pc+'; compatibilityVersion = "Xcode 14.0"; developmentRegion = en; knownRegions = (en,Base); mainGroup = '+main+'; productRefGroup = '+products+'; projectDirPath = ""; projectRoot = ""; targets = ('+target+'); }')
(p/'Beanbound.xcodeproj/project.pbxproj').write_text('// !$*UTF8*$!\n{archiveVersion = 1; classes = {}; objectVersion = 56; objects = {\n'+ '\n'.join(k+' = '+v+';' for k,v in obj.items())+'\n}; rootObject = '+project+'; }')
