// A deterministic, dependency-free Xcode project generator. No XcodeGen/CocoaPods installation.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const id=s=>crypto.createHash('sha256').update(s).digest('hex').slice(0,24).toUpperCase();
const q=JSON.stringify, objects=[];
const add=(name,body)=>{objects.push(`${id(name)} = { ${body} };`);return id(name)};
const list=values=>`(${values.join(',')})`;
const walk=p=>fs.readdirSync(path.join(root,p),{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(`${p}/${e.name}`):[`${p}/${e.name}`]);
const sources=walk('Ascend').filter(p=>p.endsWith('.swift'));
const tests=walk('UITests').filter(p=>p.endsWith('.swift'));
const resources=['Ascend/Resources/workspace-tools.json','Ascend/Resources/colleges.json','Ascend/Resources/college-media.json','Ascend/Resources/ical-LICENSE.txt','Ascend/Resources/PlusJakartaSans.ttf','Ascend/Resources/plus-jakarta-sans-OFL.txt','Ascend/Core/Resources/calendar.js','Ascend/Assets.xcassets','Ascend/PrivacyInfo.xcprivacy'];
const files=[...sources,...tests,...resources,'Ascend/Info.plist'];
for(const p of files){let type=p.endsWith('.swift')?'sourcecode.swift':p.endsWith('.xcassets')?'folder.assetcatalog':p.endsWith('.plist')||p.endsWith('.xcprivacy')?'text.plist.xml':p.endsWith('.js')?'sourcecode.javascript':p.endsWith('.ttf')?'file':p.endsWith('.txt')?'text':'text.json';add('file:'+p,`isa = PBXFileReference; lastKnownFileType = ${q(type)}; path = ${q(p)}; sourceTree = "<group>";`);}
add('appProduct','isa = PBXFileReference; explicitFileType = wrapper.application; path = Ascend.app; sourceTree = BUILT_PRODUCTS_DIR;');
add('testProduct','isa = PBXFileReference; explicitFileType = wrapper.cfbundle; path = AscendUITests.xctest; sourceTree = BUILT_PRODUCTS_DIR;');
add('products',`isa = PBXGroup; children = ${list([id('appProduct'),id('testProduct')])}; name = Products; sourceTree = "<group>";`);
add('mainGroup',`isa = PBXGroup; children = ${list([...files.map(p=>id('file:'+p)),id('products')])}; sourceTree = "<group>";`);
for(const p of [...sources,...tests,...resources])add('build:'+p,`isa = PBXBuildFile; fileRef = ${id('file:'+p)};`);
const phase=(name,type,paths)=>add(name,`isa = ${type}; buildActionMask = 2147483647; files = ${list(paths.map(p=>id('build:'+p)))}; runOnlyForDeploymentPostprocessing = 0;`);
phase('sources','PBXSourcesBuildPhase',sources);phase('resources','PBXResourcesBuildPhase',resources);phase('frameworks','PBXFrameworksBuildPhase',[]);
phase('testSources','PBXSourcesBuildPhase',tests);phase('testResources','PBXResourcesBuildPhase',[]);phase('testFrameworks','PBXFrameworksBuildPhase',[]);
const projectBase={ALWAYS_SEARCH_USER_PATHS:'NO',CLANG_ENABLE_MODULES:'YES',CLANG_ENABLE_OBJC_ARC:'YES',CLANG_WARN_DOCUMENTATION_COMMENTS:'YES',IPHONEOS_DEPLOYMENT_TARGET:'17.0',SDKROOT:'iphoneos',SWIFT_VERSION:'5.0',SWIFT_STRICT_CONCURRENCY:'targeted',ENABLE_USER_SCRIPT_SANDBOXING:'YES',GCC_C_LANGUAGE_STANDARD:'gnu17'};
const appBase={ASSETCATALOG_COMPILER_APPICON_NAME:'AppIcon',ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME:'AccentColor',CODE_SIGN_STYLE:'Automatic',CURRENT_PROJECT_VERSION:'3',GENERATE_INFOPLIST_FILE:'NO',INFOPLIST_FILE:'Ascend/Info.plist',MARKETING_VERSION:'1.2',PRODUCT_BUNDLE_IDENTIFIER:'com.youssefelb.ascend',PRODUCT_NAME:'Ascend',TARGETED_DEVICE_FAMILY:'1,2',SUPPORTS_MACCATALYST:'NO',SWIFT_EMIT_LOC_STRINGS:'YES',LD_RUNPATH_SEARCH_PATHS:'$(inherited) @executable_path/Frameworks',ENABLE_PREVIEWS:'YES'};
const testBase={CODE_SIGN_STYLE:'Automatic',GENERATE_INFOPLIST_FILE:'YES',PRODUCT_BUNDLE_IDENTIFIER:'com.youssefelb.ascend.uitests',PRODUCT_NAME:'AscendUITests',TARGETED_DEVICE_FAMILY:'1,2',TEST_TARGET_NAME:'Ascend',LD_RUNPATH_SEARCH_PATHS:'$(inherited) @executable_path/Frameworks @loader_path/Frameworks'};
const configs=(prefix,base)=>{for(const name of ['Debug','Release']){const values={...base,...(name==='Debug'?{SWIFT_OPTIMIZATION_LEVEL:'-Onone',SWIFT_ACTIVE_COMPILATION_CONDITIONS:'DEBUG',DEBUG_INFORMATION_FORMAT:'dwarf',ONLY_ACTIVE_ARCH:'YES',ENABLE_TESTABILITY:'YES'}:{SWIFT_OPTIMIZATION_LEVEL:'-O',DEBUG_INFORMATION_FORMAT:'dwarf-with-dsym',VALIDATE_PRODUCT:'YES'})};add(prefix+name,`isa = XCBuildConfiguration; buildSettings = { ${Object.entries(values).map(([k,v])=>`${k} = ${q(v)};`).join(' ')} }; name = ${name};`);}return add(prefix+'configs',`isa = XCConfigurationList; buildConfigurations = ${list(['Debug','Release'].map(n=>id(prefix+n)))}; defaultConfigurationIsVisible = 0; defaultConfigurationName = Release;`)};
const projectConfig=configs('project',projectBase),appConfig=configs('app',appBase),testConfig=configs('test',testBase);
add('proxy',`isa = PBXContainerItemProxy; containerPortal = ${id('project')}; proxyType = 1; remoteGlobalIDString = ${id('appTarget')}; remoteInfo = Ascend;`);
add('dependency',`isa = PBXTargetDependency; target = ${id('appTarget')}; targetProxy = ${id('proxy')};`);
add('appTarget',`isa = PBXNativeTarget; buildConfigurationList = ${appConfig}; buildPhases = ${list(['sources','frameworks','resources'].map(id))}; buildRules = (); dependencies = (); name = Ascend; productName = Ascend; productReference = ${id('appProduct')}; productType = "com.apple.product-type.application";`);
add('testTarget',`isa = PBXNativeTarget; buildConfigurationList = ${testConfig}; buildPhases = ${list(['testSources','testFrameworks','testResources'].map(id))}; buildRules = (); dependencies = (${id('dependency')}); name = AscendUITests; productName = AscendUITests; productReference = ${id('testProduct')}; productType = "com.apple.product-type.bundle.ui-testing";`);
add('project',`isa = PBXProject; attributes = { BuildIndependentTargetsInParallel = YES; LastUpgradeCheck = 2630; TargetAttributes = { ${id('appTarget')} = { CreatedOnToolsVersion = 26.3; }; ${id('testTarget')} = { CreatedOnToolsVersion = 26.3; TestTargetID = ${id('appTarget')}; }; }; }; buildConfigurationList = ${projectConfig}; compatibilityVersion = "Xcode 14.0"; developmentRegion = en; hasScannedForEncodings = 0; knownRegions = (en,Base); mainGroup = ${id('mainGroup')}; productRefGroup = ${id('products')}; projectDirPath = ""; projectRoot = ""; targets = ${list([id('appTarget'),id('testTarget')])};`);
const project=path.join(root,'Ascend.xcodeproj');fs.mkdirSync(path.join(project,'xcshareddata/xcschemes'),{recursive:true});
fs.writeFileSync(path.join(project,'project.pbxproj'),`// !$*UTF8*$!\n{ archiveVersion = 1; classes = {}; objectVersion = 56; objects = {\n${objects.join('\n')}\n}; rootObject = ${id('project')}; }\n`);
const ref=(target,buildable)=>`<BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="${id(target)}" BuildableName="${buildable}" BlueprintName="${target==='appTarget'?'Ascend':'AscendUITests'}" ReferencedContainer="container:Ascend.xcodeproj"/>`;
fs.writeFileSync(path.join(project,'xcshareddata/xcschemes/Ascend.xcscheme'),`<?xml version="1.0" encoding="UTF-8"?>
<Scheme LastUpgradeVersion="2630" version="1.3"><BuildAction parallelizeBuildables="YES" buildImplicitDependencies="YES"><BuildActionEntries>
<BuildActionEntry buildForTesting="YES" buildForRunning="YES" buildForProfiling="YES" buildForArchiving="YES" buildForAnalyzing="YES">${ref('appTarget','Ascend.app')}</BuildActionEntry>
<BuildActionEntry buildForTesting="YES" buildForRunning="NO" buildForProfiling="NO" buildForArchiving="NO" buildForAnalyzing="NO">${ref('testTarget','AscendUITests.xctest')}</BuildActionEntry>
</BuildActionEntries></BuildAction><TestAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" shouldUseLaunchSchemeArgsEnv="YES"><Testables><TestableReference skipped="NO">${ref('testTarget','AscendUITests.xctest')}</TestableReference></Testables></TestAction>
<LaunchAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" launchStyle="0" useCustomWorkingDirectory="NO" ignoresPersistentStateOnLaunch="NO" debugDocumentVersioning="YES" debugServiceExtension="internal" allowLocationSimulation="YES"><BuildableProductRunnable runnableDebuggingMode="0">${ref('appTarget','Ascend.app')}</BuildableProductRunnable></LaunchAction>
<ProfileAction buildConfiguration="Release" shouldUseLaunchSchemeArgsEnv="YES" savedToolIdentifier="" useCustomWorkingDirectory="NO" debugDocumentVersioning="YES"><BuildableProductRunnable runnableDebuggingMode="0">${ref('appTarget','Ascend.app')}</BuildableProductRunnable></ProfileAction><AnalyzeAction buildConfiguration="Debug"/><ArchiveAction buildConfiguration="Release" revealArchiveInOrganizer="YES"/></Scheme>`);
console.log(`Generated Ascend.xcodeproj: ${sources.length} native Swift sources, ${resources.length} resources, ${tests.length} UI test source.`);
