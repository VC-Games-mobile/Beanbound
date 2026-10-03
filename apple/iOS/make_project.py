from pathlib import Path
p=Path(__file__).resolve().parent
files=['App.swift','Resources/index.html','Resources/credits.html','Resources/Licenses/BagelFatOne-OFL.txt','Resources/Licenses/Figtree-OFL.txt','PrivacyInfo.xcprivacy','LaunchScreen.storyboard','Assets.xcassets']
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
pc=configs('SDKROOT = iphoneos; IPHONEOS_DEPLOYMENT_TARGET = 17.0; SWIFT_VERSION = 5.0; CLANG_ENABLE_MODULES = YES; ENABLE_TESTABILITY = YES;')
tc=configs('PRODUCT_BUNDLE_IDENTIFIER = com.vcgames.beanbound; PRODUCT_NAME = Beanbound; TARGETED_DEVICE_FAMILY = "1,2"; GENERATE_INFOPLIST_FILE = YES; INFOPLIST_KEY_CFBundleDisplayName = Beanbound; INFOPLIST_KEY_UILaunchStoryboardName = LaunchScreen; INFOPLIST_KEY_ITSAppUsesNonExemptEncryption = NO; INFOPLIST_KEY_UIApplicationSupportsIndirectInputEvents = YES; INFOPLIST_KEY_UISupportedInterfaceOrientations = "UIInterfaceOrientationPortrait UIInterfaceOrientationLandscapeLeft UIInterfaceOrientationLandscapeRight"; "INFOPLIST_KEY_UISupportedInterfaceOrientations_iPad" = "UIInterfaceOrientationPortrait UIInterfaceOrientationPortraitUpsideDown UIInterfaceOrientationLandscapeLeft UIInterfaceOrientationLandscapeRight"; SUPPORTS_MACCATALYST = NO; CURRENT_PROJECT_VERSION = 2; MARKETING_VERSION = 1.0.8; ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon; CODE_SIGN_STYLE = Automatic; DEVELOPMENT_TEAM = P4ZB4J2Z8M; SUPPORTED_PLATFORMS = "iphoneos iphonesimulator";')
target=add('{isa = PBXNativeTarget; name = Beanbound; productName = Beanbound; productType = "com.apple.product-type.application"; productReference = '+product+'; buildConfigurationList = '+tc+'; buildPhases = ('+src+','+fw+','+res+'); buildRules = (); dependencies = (); }')
testRef=add('{isa = PBXFileReference; path = Tests/GameTests.swift; sourceTree = "<group>"; }')
testBuild=add('{isa = PBXBuildFile; fileRef = '+testRef+'; }')
obj[main]=obj[main].replace(group+','+products,group+','+testRef+','+products)
testProduct=add('{isa = PBXFileReference; explicitFileType = wrapper.cfbundle; path = BeanboundTests.xctest; sourceTree = BUILT_PRODUCTS_DIR; }')
obj[products]=obj[products].replace(product+');',product+','+testProduct+');')
testSources=add('{isa = PBXSourcesBuildPhase; buildActionMask = 2147483647; files = ('+testBuild+'); runOnlyForDeploymentPostprocessing = 0; }')
testConfig=configs('PRODUCT_BUNDLE_IDENTIFIER = com.vcgames.beanbound.tests; PRODUCT_NAME = BeanboundTests; GENERATE_INFOPLIST_FILE = YES; TARGETED_DEVICE_FAMILY = "1,2"; TEST_HOST = "$(BUILT_PRODUCTS_DIR)/Beanbound.app/Beanbound"; BUNDLE_LOADER = "$(TEST_HOST)"; CODE_SIGN_STYLE = Automatic; DEVELOPMENT_TEAM = P4ZB4J2Z8M;')
dep=add('{isa = PBXTargetDependency; target = '+target+'; }')
testTarget=add('{isa = PBXNativeTarget; name = BeanboundTests; productName = BeanboundTests; productType = "com.apple.product-type.bundle.unit-test"; productReference = '+testProduct+'; buildConfigurationList = '+testConfig+'; buildPhases = ('+testSources+'); buildRules = (); dependencies = ('+dep+'); }')
project=add('{isa = PBXProject; buildConfigurationList = '+pc+'; compatibilityVersion = "Xcode 14.0"; developmentRegion = en; knownRegions = (en,Base); mainGroup = '+main+'; productRefGroup = '+products+'; projectDirPath = ""; projectRoot = ""; targets = ('+target+','+testTarget+'); }')
(p/'Beanbound.xcodeproj/project.pbxproj').write_text('// !$*UTF8*$!\n{archiveVersion = 1; classes = {}; objectVersion = 56; objects = {\n'+ '\n'.join(k+' = '+v+';' for k,v in obj.items())+'\n}; rootObject = '+project+'; }')

scheme=p/'Beanbound.xcodeproj/xcshareddata/xcschemes/Beanbound.xcscheme'
scheme.parent.mkdir(parents=True,exist_ok=True)
scheme.write_text(f'''<?xml version="1.0" encoding="UTF-8"?>
<Scheme LastUpgradeVersion="2660" version="1.3">
<BuildAction parallelizeBuildables="YES" buildImplicitDependencies="YES"><BuildActionEntries><BuildActionEntry buildForTesting="YES" buildForRunning="YES" buildForProfiling="YES" buildForArchiving="YES" buildForAnalyzing="YES"><BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="{target}" BuildableName="Beanbound.app" BlueprintName="Beanbound" ReferencedContainer="container:Beanbound.xcodeproj"/></BuildActionEntry></BuildActionEntries></BuildAction>
<TestAction buildConfiguration="Debug" shouldUseLaunchSchemeArgsEnv="YES"><Testables><TestableReference skipped="NO"><BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="{testTarget}" BuildableName="BeanboundTests.xctest" BlueprintName="BeanboundTests" ReferencedContainer="container:Beanbound.xcodeproj"/></TestableReference></Testables></TestAction>
<LaunchAction buildConfiguration="Debug" launchStyle="0" useCustomWorkingDirectory="NO" ignoresPersistentStateOnLaunch="NO" debugServiceExtension="internal" allowLocationSimulation="YES"><BuildableProductRunnable runnableDebuggingMode="0"><BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="{target}" BuildableName="Beanbound.app" BlueprintName="Beanbound" ReferencedContainer="container:Beanbound.xcodeproj"/></BuildableProductRunnable></LaunchAction>
<ProfileAction buildConfiguration="Release" shouldUseLaunchSchemeArgsEnv="YES"/><AnalyzeAction buildConfiguration="Debug"/><ArchiveAction buildConfiguration="Release" revealArchiveInOrganizer="YES"/>
</Scheme>''')
