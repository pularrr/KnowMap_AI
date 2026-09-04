import type { ResearchDocument } from "../../server/agent/research-output";

type Entry = ResearchDocument["proposal"]["newNodes"][number];
function entry(id:string, canonicalName:string, parentId:string, shortFact:string, principle:string, boundary:string, engineering:string, validation:string, code?:string):Entry {
  return {id,canonicalName,parentId,shortFact,nodeType:"method",blocks:[
    {type:"definition",title:"定义与边界",text:shortFact},
    {type:"principle",title:"原理",text:principle},
    {type:"assumptions",title:"成立假设",text:boundary},
    {type:"engineering_tradeoff",title:"工程取舍与失效风险",text:engineering},
    {type:"validation",title:"验证方法",text:validation},
    ...(code ? [{type:"code",title:"最小实现",text:"示例中的输入需满足上述形状和假设。",code,language:"python" as const}] : []),
  ]};
}

/**
 * Authored by the development assistant, not generated with the user's API key.
 * Observe: root branches -> estimation/association/numerics gaps.
 * Act: expand same-level alternatives, then engineering subproblems.
 * Observe again: distinguish criteria, numerical solvers, statistics and cards.
 * Review: scalar metrics and misconceptions remain card content where appropriate.
 */
export const referenceResearch:ResearchDocument = {
  answer:"从根节点的五个主分支检查后，补齐估计数值求解、滤波方法、检测变体、阵列谱估计、校准与学习验证等24个节点；每节点包含定义、原理、假设、工程取舍和验证方法。该批是可继续生长的基准扩充，不代表领域已穷尽。",
  coverageAssessment:"原有114节点提供主链。此次优先补齐同层方法与工程子问题；后续仍需展开干扰抑制、扩展目标模型、实时计算和实验数据集。",
  converged:false,
  gaps:["多雷达互扰的检测与抑制方法族","扩展目标随机矩阵与随机有限集模型","时序预算、内存和硬件加速","真实场景数据集与评测协议"],
  proposal:{
    summary:"开发助手构建的24节点基准扩充",
    rationale:"先梳理同层替代方案，再展开子问题；区分统计准则、数值求解器、门控统计量和关联算法。所有内容通过同一GraphOperation和Build链路生成。",
    newNodes:[
      {...entry("ls-solvers","线性最小二乘数值求解","least-squares","在给定设计矩阵与观测下求解线性LS，数值稳定性独立于统计最优性。","正规方程给出驻点条件；QR与SVD直接处理原矩阵，避免显式形成逆矩阵。","实数情形为A转置，复数雷达数据应使用共轭转置；需明确矩阵秩。","病态矩阵会放大观测及舍入误差；零残差不保证参数可信。","检查残差范数、数值秩和奇异值，并用已知解的仿真比较。"),nodeType:"problem"},
      entry("qr-least-squares","QR最小二乘求解","ls-solvers","利用正交或酉分解求满列秩过定方程的LS解。","A=QR后，通过三角求解R x=Qᴴ b得到解；不需要显式构造AᴴA。","最简实现假定满列秩；秩不确定时使用带列主元QR或SVD。","相比正规方程通常更稳健；矩阵分解成本与稀疏结构有关。","对条件数逐步增大的矩阵比较残差与参数误差。","Q, R = np.linalg.qr(A, mode='reduced')\nx = np.linalg.solve(R, Q.conj().T @ b)"),
      entry("svd-least-squares","SVD最小二乘与最小范数解","ls-solvers","通过奇异值分解处理秩亏和病态LS，返回满足阈值策略的解。","伪逆保留可辨识奇异方向，对舍弃的小奇异值方向不强行反演。","必须报告奇异值截断阈值；截断会引入偏差。","通常较QR昂贵，但能直接观察可辨识性；最小范数依赖参数尺度。","检查截断阈值变化对残差、解范数与预测性能的影响。","x = np.linalg.lstsq(A, b, rcond=None)[0]"),
      {...entry("ls-extensions","最小二乘扩展方法","least-squares","依据噪声结构与先验约束选择加权或正则化的残差目标。","权重表达观测可靠性，正则项约束解；二者作用不同，可以组合。","权重矩阵需与残差协方差相符；正则参数不能凭训练残差决定。","错误权重或过强正则会导致系统性偏差。","用独立观测比较预测误差，并做参数敏感性分析。"),nodeType:"problem"},
      entry("weighted-ls","加权最小二乘（WLS）","ls-extensions","最小化协方差归一化残差，适用于不同精度或相关观测。","使用W=Σ⁻¹；通过白化把问题转成普通LS，而不必显式求逆。","协方差应正定或明确处理其退化；高斯假设是与ML等价的额外条件。","噪声模型失配会让置信区间失真；不能把信号幅度直接当可靠性。","白化后检查残差相关性及不同观测组的误差分布。","L = np.linalg.cholesky(Sigma)\nx = np.linalg.lstsq(np.linalg.solve(L, A), np.linalg.solve(L, b), rcond=None)[0]"),
      entry("ridge-ls","岭回归与Tikhonov正则化","ls-extensions","在残差目标中增加参数或变换参数的平方惩罚。","目标为残差平方和加λ乘正则项；以偏差换取不稳定方向的方差下降。","参数尺度、正则矩阵和λ需要明确；并非所有物理参数都应同等惩罚。","正则化改善病态性但不会创造观测信息；过大λ会压制真实结构。","用留出数据或仿真真值比较偏差、方差与预测误差。"),
      entry("linear-kf","线性卡尔曼滤波（KF）","kf-family","在线性状态和观测模型下递推状态均值与协方差。","预测传播先验，创新及其协方差决定增益，再融合当前量测。","线性高斯条件下给出完整高斯后验；非高斯时仍需明确二阶假设。","Q和R失配、数值非对称及丢帧会影响稳定性。","有真值时检查NEES，无真值时检查NIS和创新白性。"),
      entry("extended-kf","扩展卡尔曼滤波（EKF）","kf-family","在当前工作点线性化非线性动力学和观测模型。","雅可比近似传播局部不确定性，随后执行类似KF的创新更新。","局部一阶近似需足够准确；角度残差必须处理周期性。","远离正确工作点时可能线性化失效；解析雅可比要与数值差分对照。","扫初始误差与机动强度，检查发散率和一致性。"),
      entry("unscented-kf","无迹卡尔曼滤波（UKF）","kf-family","用确定性sigma点传播非线性变换后的均值与协方差。","将sigma点送入非线性模型，再按权重重构统计量。","仍以有限统计量近似分布；多峰后验不因使用UKF而被完整表达。","不需要显式雅可比，但参数、协方差正定性和计算成本需要检查。","与EKF在相同噪声模型和数据上比较误差、一致性及耗时。"),
      entry("cago-cfar","GO-CFAR（最大侧均值）","detection","使用两侧背景估计中较大者形成检测门限。","相比CA更保守地应对杂波边缘，降低进入高杂波区域时的虚警风险。","两侧训练区及保护区设置必须一致；阈值系数需匹配检测统计模型。","弱目标可能因高背景侧而漏检；不要复用未经验证的CA门限系数。","分别仿真均匀噪声、杂波台阶与邻近强目标，测量Pd/Pfa。"),
      entry("caso-cfar","SO-CFAR（最小侧均值）","detection","使用两侧背景估计中较小者设置门限。","一侧训练区被目标污染时，较干净的一侧可降低目标遮蔽。","较小估计不一定代表真实CUT背景，尤其在杂波边缘。","对邻近目标有帮助，但在背景突变处可能增加虚警。","与CA、GO、OS在同一Pfa标定条件下比较检测损失。"),
      entry("mvdr-spectrum","MVDR/Capon谱估计","spectrum","在保持目标方向单位响应的约束下最小化输出功率。","利用协方差逆与导向矢量形成自适应谱；工程实现采用线性求解。","需要可用协方差估计和较准确的阵列流形。","快拍不足、校准误差及病态协方差可能导致目标自抑制；可研究对角加载。","对快拍数、加载量和角度失配扫描，报告分辨率与偏差。"),
      entry("esprit-angle","ESPRIT参数估计","spectrum","利用成对平移子阵之间的旋转不变性估计空间频率。","从信号子空间的子阵关系提取特征值相位，避免逐角度谱峰搜索。","需满足子阵几何条件、可辨识目标数以及足够秩。","相干信号、阵列失配与目标数错误会破坏估计。","与MUSIC在相同快拍和校准条件下比较误差、分辨能力及耗时。"),
      {...entry("sweep-linearity","调频非线性","chirp","实际瞬时频率相对理想线性斜坡的偏差。","非线性使去斜信号不再是理想定频正弦，可造成谱展宽和测距偏差。","需区分确定性斜坡误差与随机相位噪声。","不同采样起点、温度和距离可能暴露不同误差，校准不能只验证单点。","用参考目标或频率测量检查残差随时间和距离的变化。"),nodeType:"phenomenon"},
      {...entry("chirp-cycle","Chirp周期与空闲时间","chirp","慢时间采样间隔由完整chirp周期决定，包含有效斜坡及空闲时间。","测速相位差使用相同发射序列的时间间隔，而非仅ADC采样窗口。","TDM-MIMO中同一TX的采样周期通常跨越多个发射时隙。","混用斜坡时间和发射重复时间会把速度轴缩放错误。","依据实际时间戳构造慢时间轴，用已知运动目标验证。"),nodeType:"parameter"},
      entry("tdm-motion-compensation","TDM-MIMO运动相位补偿","tdma","补偿不同TX发射时刻的运动相位差，恢复一致的虚拟阵列快照。","用速度或Doppler估计预测TX时间偏移的相位，再进行通道相位对齐。","补偿依赖正确时间戳、速度符号和无模糊速度假设。","速度混叠与多目标同单元会使单一补偿失败。","固定角度并扫速度，比较补偿前后角偏差与旁瓣。"),
      entry("range-bias-calibration","距离偏置校准","calibration","用已知几何距离估计固定或配置相关的测距偏置。","把测距系统误差与目标随机波动分开建模并补偿。","参考距离定义须一致；近场、安装相位中心和多径需控制。","单点偏置不能修复比例因子误差，也不能覆盖全部温度配置。","多距离回归验证偏置和斜率，另用独立目标检查残差。"),
      entry("temperature-calibration","温度相关幅相校准","calibration","建模通道响应随温度变化的规律，降低角度和幅度漂移。","根据标定数据插值或补偿通道复系数。","温度读数与射频实际热状态可能存在迟滞。","补偿模型外推风险高；器件自校准与场景校准不能混为一谈。","升温和降温两条轨迹重复测量幅相残差与角偏差。"),
      entry("extrinsic-calibration","雷达外参标定","network","估计雷达坐标系到车辆、场景或其他传感器坐标系的变换。","利用共同目标、几何约束或运动轨迹估计旋转和平移。","匹配对应关系与时间同步必须足够准确，几何分布应可观测。","退化场景可能无法约束某些自由度；时间错位会被误吸收到外参。","使用独立轨迹和多距离、多方位目标验证投影误差。"),
      {...entry("assignment-solvers","线性分配求解器","deterministic-assignment","在给定代价矩阵和约束下求解离散匹配的算法族。","求解器只优化给定目标；GNN还包含门控、代价构造与漏检处理。","代价维度、无效边和未分配惩罚要明确。","求解最优不等于关联正确：错误代价仍会得到错误匹配。","小规模穷举校验最优代价，再测量大规模时延。"),nodeType:"problem"},
      entry("auction-assignment","拍卖式分配算法","assignment-solvers","通过价格更新与竞价迭代求解分配问题。","对象选择净收益最大的任务，冲突通过价格更新逐步化解。","精度参数与代价缩放、终止条件有关。","近似精度、并行实现与最坏延迟需要权衡。","与可信求解器对照总成本及约束满足情况。"),
      entry("multi-hypothesis-tracking","多假设跟踪（MHT）","probabilistic-association","跨多帧保留多个关联历史，在后续证据到达后逐步消歧。","区别于单帧边缘化更新，MHT保留路径或假设树并进行评分和裁剪。","检测率、杂波模型和航迹生成假设应与场景匹配。","假设数会快速增长，需门控、聚类、剪枝与延迟决策策略。","在交叉、遮挡和杂波场景下比较身份切换率、连续性与成本。"),
      entry("scene-holdout","按场景分组的留出验证","domain-shift","把独立道路、场景或采集序列作为训练与测试的分组单位。","避免相邻帧高度相关导致随机划分过于乐观。","需要明确目标部署分布，按场景分组不能自动覆盖所有域偏移。","小样本场景方差较大，指标应按场景报告。","检查分组无泄漏，报告各场景性能分布和最差组。"),
      entry("sensor-holdout","跨设备留出验证","domain-shift","使用未参与训练的雷达设备或安装配置评估泛化能力。","硬件、标定与安装变化可影响幅相统计和目标分布。","需要区分硬件差异与场景差异，控制混杂因素。","整体均值可能掩盖个别设备失效；应结合校准状态。","报告逐设备的检测、定位误差与置信度校准结果。"),
    ],
    cardBlocks:[
      {nodeId:"fmcw",type:"procedure",title:"从原始数据到对象的处理顺序",text:"确定波形与采样时序 → 形成Rx×Chirp×Sample数据立方体 → 距离处理 → Doppler处理 → 检测 → 测角 → 聚类 → 关联 → 状态估计与航迹管理。每步记录坐标约定、时间戳、单位及不确定度。"},
      {nodeId:"fmcw",type:"validation",title:"分层验证",text:"先用单目标检查距离、速度和角度轴，再用多目标验证分辨与检测，最后检查关联、身份连续性和事件误报。每层错误独立定位，不能只用最终可视化判断正确性。"},
      {nodeId:"estimators",type:"comparison",title:"LS、ML、MAP、MMSE的边界",text:"LS是残差损失准则；ML最大化似然；MAP取后验众数；MMSE在平方损失下取后验均值。它们不都属于似然估计。固定方差独立高斯噪声下LS可与ML一致；高斯先验还可导出特定正则化MAP。"},
      {nodeId:"association",type:"misconception",title:"区分统计量、求解器与关联方法",text:"马氏距离度量归一化创新；门控筛除不可行匹配；匈牙利或拍卖算法求解指定分配目标；GNN选择全局硬关联，JPDA计算联合事件的边缘关联概率。四者不能当成同一层的互换方法。"},
      {nodeId:"range-fft",type:"code",title:"距离维FFT",text:"假设数据最后一维为快时间；窗口需与采样点数一致。",code:"spectrum = np.fft.fft(x * np.hanning(x.shape[-1]), axis=-1)",language:"python"},
      {nodeId:"doppler-fft",type:"code",title:"慢时间FFT",text:"假设输入维度为Rx×Chirp×Range；每个TX需先形成一致慢时间序列。",code:"rd = np.fft.fftshift(np.fft.fft(range_fft, axis=1), axes=1)",language:"python"},
    ],
    relations:[
      {sourceId:"qr-least-squares",targetId:"svd-least-squares",type:"ALTERNATIVE_TO",rationale:"同一线性LS数值求解问题的两类方法，秩与稳定性条件不同。"},
      {sourceId:"linear-kf",targetId:"extended-kf",type:"ALTERNATIVE_TO",rationale:"按线性或非线性模型选择状态估计方法，不表示任意场景可直接互换。"},
      {sourceId:"extended-kf",targetId:"unscented-kf",type:"ALTERNATIVE_TO",rationale:"非线性滤波中局部线性化与sigma点近似的比较。"},
      {sourceId:"doppler-fft",targetId:"tdm-motion-compensation",type:"INPUT_TO",rationale:"Doppler估计为发射时隙运动相位补偿提供速度信息。"},
      {sourceId:"mahalanobis-gate",targetId:"gnn",type:"INPUT_TO",rationale:"统计距离可用于GNN的门控与代价构造。"},
      {sourceId:"hungarian-algorithm",targetId:"gnn",type:"IMPLEMENTS",rationale:"匈牙利算法可实现GNN的线性分配求解步骤，而非整个关联框架。"},
    ],
    evidence:[
      {title:"TI FMCW radar fundamentals",url:"https://www.ti.com/lit/SPYY005",note:"用于核对距离、速度、角度处理的基本物理关系。"},
      {title:"MathWorks Numerical Computing: Least Squares",url:"https://www.mathworks.com/content/dam/mathworks/mathworks-dot-com/moler/leastsquares.pdf",note:"用于核对正规方程、QR和SVD的数值稳定性讨论。"},
      {title:"MathWorks Assignment Methods in Tracking",url:"https://www.mathworks.com/help/fusion/ug/introduction-to-assignment-methods-in-tracking-systems.html",note:"用于核对门控、GNN和JPDA的角色区别；其余工程卡片为开发助手整理，需按具体项目实验验证。"},
    ],
  },
};
